#!/usr/bin/env node

/**
 * NoDent - Asynchronous JavaScript Language extensions for Node
 * 
 * AST transforms and node loader extension 
 */

var fs = require('fs') ;

/* A patch that adds two new keywords to Uglify parsing: async and await, a la ES7 */
function U2patch(){
	var predicates = {
		KEYWORDS:KEYWORDS,
		KEYWORDS_BEFORE_EXPRESSION:KEYWORDS_BEFORE_EXPRESSION,
		OPERATORS:OPERATORS,
		UNARY_PREFIX:UNARY_PREFIX
	} ;
	var preds = {await:true,async:true} ;
	KEYWORDS = function(str){ return str in preds || predicates.KEYWORDS.apply(this,arguments) ; } ;
	KEYWORDS_BEFORE_EXPRESSION = function(str){ return str in preds || predicates.KEYWORDS_BEFORE_EXPRESSION.apply(this,arguments) ; } ;
	OPERATORS = function(str){ return str in preds || predicates.OPERATORS.apply(this,arguments) ; } ;
	UNARY_PREFIX = function(str){ return str in preds || predicates.UNARY_PREFIX.apply(this,arguments) ; } ;
}
var U2 = require("./ug2loader").load(U2patch) ;

var SourceMapConsumer = require('source-map').SourceMapConsumer;

var config = {
		sourceMapping:1,	/* 0: Use config value, 1: rename files for Node, 2: rename files for Web, 3: No source map */
		use:[],
		useDirective:"use nodent",
		useES7Directive:"use nodent-es7",
		extension:'.njs',
		$return:"$return",
		$error:"$error",
		$except:"$except",
		// Pre-ES7 tokens: for async-function() ** OBSOLOETE **
		// define:"-",
		// async:"async",
		// Pre-ES7 tokens for async assignment
		assign:"<<=",
		ltor:true	/* true: val <<= async(),   false: async() <<= val */
};

var decorate = new U2.TreeWalker(function(node) {
	node.$ = "------------".substring(0,decorate.stack.length)+"\t"+node.CTOR.name+"\t"+node.print_to_string() ;
	console.log(node.$) ;
});

/**
 * returnMapper is an Uglify2 transformer that is used to change statements such as:
 * 		return some-expression ;
 * into
 * 		return $return(some-expression) ;
 * for the current scope only -i.e. returns nested in inner functions are NOT modified.
 * 
 * This allows us to capture a normal "return" statement and actually implement it
 * by calling the locally-scoped function $return()
 */
var lambdaNesting = 0 ;
var tryNesting = 0 ;

var returnMapper = new U2.TreeTransformer(function(node,descend) {
	if (!lambdaNesting && (node instanceof U2.AST_Return)) {
		var repl = node.clone() ;
		var value = repl.value?[repl.value.clone()]:[] ;
		/*
		 * NB: There is a special case where we do a REAL return to allow
		 * for chained async-calls. This is the following case:
		 * 
		 * Rather than doing:
		 * 		x <<= f() ;
		 * 		return x ;
		 * 
		 * We want to do:
		 * 		f($return,$error) ;
		 * 		return ;
		 * 
		 * ...i.e. "f" will actually do the return, not us.
		 * 
		 * The selected syntax for this is:
		 * 
		 * 	return void (expr) ;
		 * 
		 * which is mapped to:
		 * 
		 * 	return (expr) ;
		 * 
		 * Note that the parenthesis are necessary in the case of anything except a single sumbol as "void" binds to
		 * values before operator.
		 *  
		 * In the case where we REALLY want to return undefined to the callback, a simple "return" or "return undefined" 
		 * works.
		 */
		if (value.length>0 && value[0] instanceof U2.AST_UnaryPrefix && value[0].operator=="void") {
			repl.value = value[0].expression ;
		} else {
			repl.value = new U2.AST_Call({
				expression:new U2.AST_SymbolRef({name:config.$return}),
				args:value
			}) ;
		}
		repl.end = repl.value.end = repl.start = repl.value.start = new U2.AST_Token(node.end);
		return repl ;
	} else if (!tryNesting && (node instanceof U2.AST_Throw)) {
		var value = node.value.clone() ;
		var repl = new U2.AST_Return({
			value:new U2.AST_Call({
				expression:new U2.AST_SymbolRef({name:config.$error}),
				args:[value]
			})
		}) ;
		repl.start = repl.value.start = node.start ;
		repl.end = repl.value.end = node.end ;
		return repl ;
	} else if (node instanceof U2.AST_Lambda) {
		lambdaNesting++ ;
		descend(node, this);
		lambdaNesting-- ;
		return node ;
	} else if (node instanceof U2.AST_Try) {
		tryNesting++ ;
		descend(node, this);
		tryNesting-- ;
		return node ;
	}  else {
		descend(node, this);
		return node ;
	}
});


/**
 * ES7 await keyword - transform an AST like:
console.log("start") ;
console.log(await test(1)) ;
console.log("ok") ;

 * to:
console.log("start") ;
return test(1)(function(_var){
console.log(_var) ;
console.log("ok") ;
});
*/

/* Bit of a hack: without having to search for references to this
 * node, force it to be some replacement node */
function coerce(node,replace) {
	node.__proto__ = Object.getPrototypeOf(replace) ;
	Object.keys(node).forEach(function(k){ delete node[k]}) ;
	Object.keys(replace).forEach(function(k){ node[k] = replace[k]}) ;
}

var generatedSymbol = 1 ;
function asyncAwait(ast,opts) {
	if (!opts.es7) {
		// Only load deprecated ES5 behaviour if the app uses it.
		var asyncAssignTransfom = require('./es5plus')(U2,config) ;
		return ast.transform(asyncAssignTransfom) ;
	}
	
	var asyncWalk = new U2.TreeWalker(function(node, descend){
		if (node instanceof U2.AST_UnaryPrefix && node.operator=="await") {
			var result = new U2.AST_SymbolRef({
				name:"$await_"+
				node.expression.print_to_string().replace(/[^a-zA-Z0-9_\.\$\[\]].*/g,"").replace(/[\.\[\]]/g,"_")
				+"$"+generatedSymbol++}) ;
			var expr = node.expression.clone() ;
			coerce(node,result) ;

			var stmt = asyncWalk.find_parent(U2.AST_Statement) ;
			var block ;
			var terminate ;

			function terminateLoop(call) {
				block.body.push(new U2.AST_SimpleStatement({body:call})) ;
				block.body.push(new U2.AST_Continue()) ;
			} 

			for (var n=asyncWalk.stack.length-1; n>=0; n--) {
				if (asyncWalk.stack[n] instanceof U2.AST_IterationStatement) {
					terminate = terminateLoop ;
					block = new U2.AST_BlockStatement({body:[asyncWalk.stack[n].body]}) ;
					asyncWalk.stack[n].body = block ;
					break ;
				}
				if (n>0 && (asyncWalk.stack[n-1] instanceof U2.AST_IterationStatement)
						&& (asyncWalk.stack[n] instanceof U2.AST_Block)) {
					terminate = terminateLoop ;
					block = asyncWalk.stack[n] ;
					break ;
				}
				/* TODO: // Finish switch block await
				if (asyncWalk.stack[n] instanceof U2.AST_SwitchBranch) {
					debugger;
					terminate = function terminateSwitchBranch(call) {
						block.body.push(new U2.AST_SimpleStatement({body:call})) ;
						block.body.push(new U2.AST_Break()) ;
					} ;
					var block = asyncWalk.stack[n].body ;
					// TODO: Enforce 'break' as final statement
					block.pop() ; // Remove final 'break'
					asyncWalk.stack[n].body = [new U2.AST_BlockStatement({body:block})] ;
					break ;
				}*/
				if (asyncWalk.stack[n] instanceof U2.AST_Block) {
					terminate = function terminateBlock(call) {
						block.body.push(new U2.AST_Return({ value:call })) ;
					} ;
					block = asyncWalk.stack[n] ;
					break ;
				}
			}
			if (!terminate)
				throw new Error("Block termination error") ;

			var i = block.body.indexOf(stmt) ;
			if (i<0)
				throw new Error("Block nesting error") ;

			var callBack = block.body.splice(i,block.body.length-i).slice(1); 
			// If stmt is only a reference to the result, suppress the result reference as it does nothing
			if (!stmt.equivalent_to(result))
				callBack.unshift(stmt);
			// Wrap the callback statement(s) in a Block and transform them
			var cbBody = new U2.AST_BlockStatement({body:callBack.map(function(e){return e.clone();})}) ;
			cbBody.walk(asyncWalk) ;

			var call = new U2.AST_Call({
				expression:expr,//asyncCall.transform(asyncAssignTransfom),
				args:[cbBody.body.length ?
						new U2.AST_Call({
							expression:new U2.AST_Dot({
								expression: new U2.AST_Function({
									argnames:[result.clone()],
									body:cbBody.body
								}),
								property: "bind"
							}),
							args:[new U2.AST_This()]
						}):new U2.AST_Function({argnames:[],body:[]}),
						new U2.AST_SymbolRef({name:config.$error})
						]
			}) ;

			terminate(call) ;
			return true ; 
		}
	}) ;
	ast.walk(asyncWalk) ;
	return ast ;
}

/**
 * Uglify transormer: Transform (non ES7)
  	async-function test(x) {
 		return x*2 ;
 	};
 *
 * or ES7
  	async function test(x) {
 		return x*2 ;
 	};
 *
 * to
 * 
  function test(x) {
    return function($return, $error) {
        try {
            return $return(x * 2);
        } catch ($except) {
            $error($except)
        }
    }.bind(this);
}
 *
 */

function asyncDefine(ast,opts) {
	var asyncWalk = new U2.TreeWalker(function(node, descend){
		if (node instanceof U2.AST_UnaryPrefix && node.operator=="async") {
			// 'async' is unary operator that takes a function as it's operand, 
			// OR, for old-style declarations, a unary negative expression yielding a function, e.g.
			// async function(){} or async-function(){}
			// The latter form is deprecated, but has the advantage of being ES5 syntax compatible
			var fn = node.expression ;
			if (!(opts.es7) && (fn instanceof U2.AST_UnaryPrefix && fn.operator=='-'))
				fn = fn.expression.clone() ;
			if (fn instanceof U2.AST_Function) {
				var replace = fn.clone() ;
				/* Replace any occurrences of "return" for the current function (i.e., not nested ones)
				 * with a call to "$return" */
				var fnBody = fn.body.map(function(sub){
					var ast = sub.transform(returnMapper)
					ast.walk(asyncWalk) ;
					return ast ;
				}) ;
	
				replace.body = [new U2.AST_Return({
					value:new U2.AST_Call({
						expression:new U2.AST_Dot({
							expression: new U2.AST_Function({
								argnames:[new U2.AST_SymbolFunarg({name:config.$return}),new U2.AST_SymbolFunarg({name:config.$error})],
								body:[new U2.AST_Try({
									body:fnBody,
									bcatch:new U2.AST_Catch({
										argname:new U2.AST_SymbolCatch({name:config.$except}),
										body:[new U2.AST_Call({
											expression:new U2.AST_SymbolRef({name:config.$error}),
											args:[new U2.AST_SymbolRef({name:config.$except})]
										})]
									})
								})]
							}),
							property: "bind"
						}),
						args:[new U2.AST_This()]
					})
				})] ;
				
				var parent = asyncWalk.parent(0) ;
				if (parent instanceof U2.AST_SimpleStatement) {
					coerce(parent,replace) ;
				} else {
					coerce(node,replace) ;
				}
				return true ;
			}
		}
	});
	ast.walk(asyncWalk) ;
	return ast ;
}

function stripBOM(content) {
	// Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
	// because the buffer-to-string conversion in `fs.readFileSync()`
	// translates it to FEFF, the UTF-16 BOM.
	if (content.charCodeAt(0) === 0xFEFF) {
		content = content.slice(1);
	}
	return content;
}

function btoa(str) {
	var buffer ;

	if (str instanceof Buffer) {
		buffer = str;
	} else {
		buffer = new Buffer(str.toString(), 'binary');
	}

	return buffer.toString('base64');
}

//Hack: go though and create "padding" mappings between lines
//Without this, whole blocks of code resolve to call & return sequences.
//This has dependency on the implemenation of source-map  which is
//not a healthy thing to have.
function createMappingPadding(mapping) {
	var m = mapping._mappings._array;
	m.sort(function(a,b){
		if (a.generatedLine < b.generatedLine)
			return -1 ;
		if (a.generatedLine > b.generatedLine)
			return 1 ;
		if (a.generatedColumn < b.generatedColumn)
			return -1 ;
		if (a.generatedColumn > b.generatedColumn)
			return 1 ;
		return (a.name || "").length - (b.name || "").length ;
	}) ;

	var i = 1 ;
	while (i<m.length) {
		if (m[i-1].generatedLine < m[i].generatedLine){
			m.splice(i,0,{
				generatedColumn: 0,
				generatedLine: m[i-1].generatedLine+1,
				originalColumn: 0,
				originalLine: m[i-1].originalLine+1,
				source: m[i-1].source
			}) ;
			m[i+1].generatedColumn = 0 ;
			i += 1 ;
		}
		i += 1 ;
	}
	if (m.length)
		m.push({
			generatedColumn: 0,
			generatedLine: m[m.length-1].generatedLine+1,
			originalColumn: 0,
			originalLine: m[m.length-1].originalLine+1,
			source: m[m.length-1].source
		}) ;
}

var nodent ;

function reportParseException(ex,content,filename) {
	var sample = content.substring(ex.pos-30,ex.pos-1)
	+"^"+content.substring(ex.pos,ex.pos+1)+"^"
	+content.substring(ex.pos+1,ex.pos+31) ;
	sample = sample.replace(/[\r\n\t]+/g,"\t") ;
	console.error("NoDent JS: "+filename+" (line:"+ex.line+",col:"+ex.col+"): "+ex.message+"\n"+sample) ;
} 

var configured = false ;
function initialize(opts){
	if (!opts)
		opts = config ;

	if (!configured) {
		// Fill in default config values
		for (var k in config) {
			if (!opts.hasOwnProperty(k))
				opts[k] = config[k] ;
		}

		var smCache = {} ;
		nodent = {
			compile:function(code,origFilename,sourceMapping,opts) {
				try {
					opts = opts || {} ;
					sourceMapping = sourceMapping || config.sourceMapping ; 
					var pr = nodent.parse(code,origFilename,sourceMapping,opts);
					nodent.asynchronize(pr,sourceMapping,opts) ;
					nodent.prettyPrint(pr,sourceMapping,opts) ;
					return pr ;
				} catch (ex) {
					if (ex.constructor.name=="JS_Parse_Error") 
						reportParseException(ex,code,origFilename) ;
					console.log("NoDent JS: Warning - couldn't parse "+origFilename+" (line:"+ex.line+",col:"+ex.col+"). Reason: "+ex.message) ;
					if (ex instanceof Error)
						throw ex ;
					else {
						var wrapped = new Error(ex.toString()) ;
						wrapped.causedBy = ex ;
						throw wrapped ;
					}
				}
			},
			parse:function(code,origFilename,sourceMapping,opts) {
				sourceMapping = sourceMapping || config.sourceMapping ; 
				if (sourceMapping==2)
					origFilename = origFilename+".nodent" ;
				var r = { origCode:code.toString(), filename:origFilename } ;
				r.ast = U2.parse(r.origCode, {strict:false,filename:r.filename}) ;
				r.ast.figure_out_scope();
				return r ;
			},
			asynchronize:function(pr,sourceMapping,opts) {
				sourceMapping = sourceMapping || config.sourceMapping ; 

				if (sourceMapping==2)
					pr.filename = pr.filename.replace(/\.nodent$/,"") ;
				if (sourceMapping==1)
					pr.filename += ".nodent" ;
				pr.ast = asyncDefine(pr.ast,opts) ;
				pr.ast = asyncAwait(pr.ast,opts) ;
				return pr ;
			},
			prettyPrint:function(pr,sourceMapping,opts) {
				sourceMapping = sourceMapping || config.sourceMapping ; 

				var map ;
				if (sourceMapping==1 || sourceMapping==2)
					map = U2.SourceMap({
						file:pr.filename,
						orig: pr.origMap?pr.origMap.toString():null}) ;

				var str = U2.OutputStream({source_map:map,beautify:true,comments:true,bracketize:true, width:160, space_colon:true}) ;
				pr.ast.print(str);

				if (map) {
					createMappingPadding(map.get()) ;

					var jsmap = map.get().toJSON() ;
					jsmap.sourcesContent = [pr.origCode] ;
					smCache[pr.filename] = {map:jsmap,smc:new SourceMapConsumer(jsmap)} ;
					var mapUrl = "\n/*"
					+"\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,"+btoa(JSON.stringify(jsmap))
					+"\n*/" ;
				}
				pr.code = str.toString()+(map?mapUrl:"") ;
			},
			decorate:function(pr) {
				pr.ast.walk(decorate) ;
			},
			require:function(cover) {
				if (!nodent[cover]) {
					if (cover.indexOf("/")>=0)
						nodent[cover] = require(cover)(nodent,opts.use[cover]) ;
					else
						nodent[cover] = require("./covers/"+cover)(nodent,opts.use[cover]) ;
				}
				return nodent[cover] ;
			},
			generateRequestHandler:function(path, matchRegex, options) {
				var cache = {} ;

				if (!matchRegex)
					matchRegex = /\.njs$/ ;
				if (!options)
					options = {} ;

				return function (req, res, next) {
					if (!req.url.match(matchRegex))
						return next && next() ;

					if (cache[req.url]) {
						res.setHeader("Content-Type", "application/javascript");
						options.setHeaders && options.setHeaders(res) ;
						res.write(cache[req.url]) ;
						res.end();
					}

					function sendException(ex) {
						res.statusCode = 500 ;
						res.write(ex.toString()) ;
						res.end() ;
					}

					var filename = path+req.url ;
					fs.readFile(filename,function(err,content){
						if (err) {
							return sendException(err) ;
						} else {
							try {
								var pr = nodent.compile(content.toString(),req.url,2);
								if (options.enableCache)
									cache[req.url] = pr.code ; // Don't cache for now
								res.setHeader("Content-Type", "application/javascript");
								options.setHeaders && options.setHeaders(res) ;
								res.write(pr.code) ;
								res.end();
							} catch (ex) {
								return sendException(ex) ;
							}
						}
					}) ;
				};
			},
			AST:U2
		};

		/**
		 * We need a global to handle funcbacks for which no error handler has ever been deifned.
		 */
		global[config.$error] = function(err) {
			throw err ;
		};

		if (!opts.dontMapStackTraces) {
			// This function is part of the V8 stack trace API, for more info see:
			// http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
			Error.prepareStackTrace = function(error, stack) {
				function mappedTrace(frame) {
					var source = frame.getFileName();
					if (source && smCache[source]) {
						var position = smCache[source].smc.originalPositionFor({line: frame.getLineNumber(), column: frame.getColumnNumber()-1});
						var desc = frame.toString() ;

						var s = source.split("/"), d = smCache[source].map.sources[0].split("/") ;
						for (var i=0; i<s.length && s[i]==d[i]; i++) ;
						desc = desc.substring(0,desc.length-1)+" => \u2026"+d.slice(i).join("/")+":"+position.line+":"+position.column+")" ;

						return '\n    at '+desc ;
					}
					return '\n    at '+frame;
				}

				return error + stack.map(mappedTrace).join('');
			}

		}

		/**
		 * NoDentify (make async) a general function.
		 * The format is function(a,b,cb,d,e,f){}.noDentify(cbIdx,errorIdx,resultIdx) ;
		 * for example:
		 * 		http.aGet = http.get.noDentify(1) ;	// The 1st argument (from zero) is the callback. errorIdx is undefined (no error)
		 * 
		 * The function is transformed from:
		 * 		http.get(opts,function(result){}) ;
		 * to:
		 * 		http.aGet(opts)(function(result){}) ;
		 * 
		 */
		Object.defineProperty(Function.prototype,"noDentify",{
			value:function(idx,errorIdx,resultIdx) {
				var fn = this ;
				return function() {
					var scope = this ;
					var args = Array.prototype.slice.apply(arguments) ;
					return function(ok,error) {
						if (undefined==idx)	// No index specified - use the final (unspecified) parameter
							idx = args.length ;
						if (undefined==errorIdx)	// No error parameter in the callback - just pass to ok()
							args[idx] = ok ;
						else {
							args[idx] = function() {
								var err = arguments[errorIdx] ;
								var result = arguments[resultIdx===undefined?errorIdx+1:resultIdx] ;
								if (err)
									return error(err) ;
								return ok(result) ;
							} ;
						}
						return fn.apply(scope,args) ;
					}
				};
			},
			configurable:false,
			enumerable:false,
			writable:true
		}) ;

		// Method to wrap error handlers
		Object.defineProperty(Function.prototype,"chain$error",{
			value:function(handler){ 
				var prev = this ; return function(){
					var a = Array.prototype.slice.call(arguments,0) ;
					a.push(prev) ;
					return handler.apply(this,a);
				} ; 
			},
			configurable:false,
			enumerable:false,
			writable:true
		}) ;

		var stdJSLoader = require.extensions['.js'] ; 
		if (opts.useDirective || opts.useES7Directive) {
			require.extensions['.js'] = function(mod,filename) {
				var code,content = stripBOM(fs.readFileSync(filename, 'utf8'));
				try {
					var pr = nodent.parse(content,filename);
					for (var i=0; i<pr.ast.body.length; i++) {
						if (pr.ast.body[i] instanceof U2.AST_Directive) {
							if (pr.ast.body[i].value==opts.useDirective) {
								return require.extensions[opts.extension](mod,filename) ;
							}
							if (pr.ast.body[i].value==opts.useES7Directive) {
								return require.extensions[opts.extension](mod,filename,{es7:true}) ;
							}
						}
					}
				} catch (ex) { /* Meh. Try using the JS parser */ }
				return stdJSLoader(mod,filename) ;
			} ;
		}

		require.extensions[opts.extension] = function(mod, filename, opts) {
			try {
				opts = opts || {} ;
				var content = stripBOM(fs.readFileSync(filename, 'utf8'));
				var pr = nodent.parse(content,filename,opts);
				nodent.asynchronize(pr,undefined,opts) ;
				nodent.prettyPrint(pr,undefined,opts) ;
				mod._compile(pr.code, pr.filename);
			} catch (ex) {
				if (ex.constructor.name=="JS_Parse_Error") 
					reportParseException(ex,content,filename) ;
				throw ex ;
			}
		};
	}

	if (Array.isArray(opts.use))
		opts.use.forEach(nodent.require) ;
	else {
		Object.keys(opts.use).forEach(nodent.require) ;
	}

	for (var k in opts) {
		if (!config.hasOwnProperty(k))
			throw new Error("NoDent: unknown option: "+k+"="+JSON.stringify(opts[k])) ;
		if (k!="use") 
			config[k] = opts[k] ;
	}
	configured = true ;
	return nodent ;
} ;

initialize.asyncify = function asyncify(obj,filter) {
	filter = filter || function(k,o) {
		return (!k.match(/Sync$/) || !(k.replace(/Sync$/,"") in o)) ;
	};
	
	var o = Object.create(obj) ;
	for (var j in o) (function(){
		var k = j ;
		if (typeof o[k]==='function' && !o[k].isAsync && filter(k,o)) {
			o[k] = function() {
				var a = Array.prototype.slice.call(arguments) ;
				return function($return,$error) {
					a.push(function(err,ok){
						if (err)
							return $error(err) ;
						if (arguments.length==2)
							return $return(ok) ;
						return $return(Array.prototype.slice.call(arguments,1)) ;
					}) ;
					var ret = obj[k].apply(obj,a) ;
					/* EXPERIMENTAL !!
					if (ret !== undefined) {
						$return(ret) ;
					}
					*/
				}
			}
			o[k].isAsync = true ;
		}
	})() ;
	o["super"] = obj ;
	return o ;
};

module.exports = initialize ;

/* If invoked as the top level module, read the next arg and load it */
if (require.main===module && process.argv[2]) {
	module.exports(process.env.NODENT_OPTS && JSON.parse(process.env.NODENT_OPTS)) ;	// Initialise nodent
	var path = require('path') ;
	var mod = path.resolve(process.argv[2]) ;
	require(mod);
}
