/**
 * NoDent - Asynchronous JavaScript Language extensions for Node
 * 
 * AST transforms and node loader extension 
 */

var fs = require('fs') ;
var U2 = require("uglify-js");

var config = {
		sourceMapping:1,	/* 0: No source maps, 1: rename files fro Node, 2: rename files for Web */
		use:[],
		useDirective:"use nodent",
		extension:'.njs',
		$return:"$return",
		$error:"$error",
		$except:"$except",
		define:"-",
		async:"async",
		assign:"<<=",
		ltor:true	/* true: val <<= async(),   false: async() <<= val */
};

var decorate = new U2.TreeWalker(function(node) {
	node.$ = "------------".substring(0,decorate.stack.length)+"\t"+node.CTOR.name+"\t"+node.print_to_string() ;
	console.log(node.$) ;
});

function addComment(node,value){
	/*if (!node.start)
		node.start = new U2.AST_Token({comments_before:[]}) ;
	node.start.comments_before = node.start.comments_before || [] ;
	node.start.comments_before.push(new U2.AST_Token({
		type:"comment2",
		value:value
	})) ;*/
	return node ;
}

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
		repl.value = new U2.AST_Call({
			expression:new U2.AST_SymbolRef({name:config.$return}),
			args:value
		}) ;
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
 * Uglify transormer: Transform
 * 
 	x <<= y ;
 	body ;
 *
 * to
 * 
	return y(f(x){ body },bind(this),$error) ; 
 *
 */


var asyncAssign = new U2.TreeTransformer(function(node, descend){
	var isSimple = (node  instanceof U2.AST_SimpleStatement) ;
	var stmt = isSimple?node.body:node ;

	var assignee = stmt[config.ltor?"left":"right"] ; 
	var asyncCall = stmt[!config.ltor?"left":"right"] ;

	if (stmt instanceof U2.AST_Binary && stmt.operator==config.assign) {
		// Check LHS is an assignable identifier and RHS is a function call 
		if (!(assignee instanceof U2.AST_SymbolRef))
			throw new Error("Assignee of "+config.assign+" async operator must be an identifier") ;

		var undefinedReturn = assignee.name=="undefined" ;

		var block = asyncAssign.find_parent(U2.AST_Block) ;
		var i = block.body.indexOf(isSimple?node:asyncAssign.parent()) ;
		var callBack = block.body.splice(i,block.body.length-i).slice(1) ;
		// Wrap the callback statement(s) in a Block and transform them
		var cbBody = new U2.AST_BlockStatement({body:callBack.map(function(e){return e.clone();})}).transform(asyncAssign) ;
		var replace = new U2.AST_SimpleStatement({
			body:new U2.AST_Return({
				value:new U2.AST_Call({
					expression:asyncCall.transform(asyncAssign),
					args:[cbBody.body.length ?
						new U2.AST_Call({
							expression:new U2.AST_Dot({
								expression: new U2.AST_Function({
									argnames:(undefinedReturn?[]:[assignee]),
									body:cbBody.body
								}),
								property: "bind"
							}),
							args:[new U2.AST_This()]
						}):new U2.AST_Function({argnames:[],body:[]}),
						new U2.AST_SymbolRef({name:config.$error})
					]
				})
			})
		});
		addComment(replace.body.value,"*"+(undefinedReturn?"":assignee.name)+" <<= *") ;
		return replace ;
	} else {
		descend(node, this);
		return node ;
	}
}) ;

/**
 * Uglify transormer: Transform 
  	async-function test(x) {
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

var asyncDefine = new U2.TreeTransformer(function(node, descend){
	node = node.clone() ;
	var isSimple = (node  instanceof U2.AST_SimpleStatement) ;
	var stmt = isSimple?node.body:node ;
	if (stmt instanceof U2.AST_Binary 
			&& stmt.operator==config.define 
			&& stmt.left.name==config.async 
			&& stmt.right instanceof U2.AST_Function) {
		/*
		 * "stmt" is an expression of the form "async-function(){}". We're going to lose the "async" entirely, as is 
		 * used simply to decorate the function, and manipulate the function body as above.
		 */
		var replace = stmt.right.clone() ;
		/* Replace any occurrences of "return" for the current function (i.e., not nested ones)
		 * with a call to "$return" */
		var fnBody = stmt.right.body.map(function(sub){
			return sub.transform(returnMapper).transform(asyncDefine) ;
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
		addComment(replace,"* async- *") ;
		return replace ;
	} else {
		descend(node, this);
		return node ;
	}
});

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
// Hack: go though and create "padding" mappings between lines
// Without this, whole blocks of code resolve to call & return sequences.
// This has dependency on the implemenation of source-map  which is
// not a healthy thing to have.
function createMappingPadding(m) {
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

var nodent = {
		parse:function(code,origFilename) {
			if (config.sourceMapping==2)
				origFilename = origFilename+".nodent" ;
			var r = { origCode:code.toString(), filename:origFilename } ;
			r.ast = U2.parse(r.origCode, {strict:false,filename:r.filename}) ;
			r.ast.figure_out_scope();
			if (config.sourceMapping && false) {
				r.origMap = U2.SourceMap({file:r.filename}) ;
				r.origMap.get().setSourceContent(r.filename,r.origCode) ;
				r.ast.walk(new U2.TreeWalker(function(node,descend){
					descend() ;
					var token = node.start ;
					if (token) {
						r.origMap.add(token.file||"?",token.line,token.col,token.line,token.col,node.print_to_string()) ;	
					} 
					token = node.end ;
					if (token) {
						r.origMap.add(token.file||"?",token.line,token.col,token.line,token.col,"padding") ;	
					} 
					return true; // prevent descending again
				})) ;
			}
			return r ;
		},
		asynchronize:function(pr) {
			if (config.sourceMapping==2)
				pr.filename = pr.filename.replace(/\.nodent$/,"") ;
			if (config.sourceMapping==1)
				pr.filename += ".nodent" ;
			pr.ast = pr.ast.transform(asyncDefine) ; 
			pr.ast = pr.ast.transform(asyncAssign) ;
			return pr ;
		},
		prettyPrint:function(pr) {
			var map ;
			if (config.sourceMapping)
				map = U2.SourceMap({
					file:pr.filename,
					orig: pr.origMap?pr.origMap.toString():null}) ;
			
			var str = U2.OutputStream({source_map:map,beautify:true,comments:true,bracketize:true, width:160, space_colon:true}) ;
			pr.ast.print(str);
			
			if (map) {
				createMappingPadding(map.get()._mappings) ;
				
				var jsmap = JSON.parse(map.toString()) ;
				jsmap.sourcesContent = [pr.origCode] ;
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
			if (!nodent[cover])
				nodent[cover] = require("./covers/"+cover)(nodent) ;
			return nodent[cover] ;
		},
		AST:U2
};

function reportParseException(ex,content,filename) {
	var sample = content.substring(ex.pos-30,ex.pos-1)
			+"^"+content.substring(ex.pos,ex.pos+1)+"^"
			+content.substring(ex.pos+1,ex.pos+31) ;
	sample = sample.replace(/[\r\n\t]+/g,"\t") ;
	console.error("NoDent JS: "+filename+" (line:"+ex.line+",col:"+ex.col+"): "+ex.message+"\n"+sample) ;
} 

var configured = false ;
module.exports = function(opts){
	if (!opts)
		opts = config ;
	
	if (!configured) {
		// Fill in default config values
		for (var k in config) {
			if (!opts.hasOwnProperty(k))
				opts[k] = config[k] ;
		}

		/**
		 * We need a global to handle funcbacks for which no error handler has ever been deifned.
		 */
		global[config.$error] = function(err) {
			throw err ;
		};

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
		 */
		Function.prototype.noDentify = function(idx,errorIdx,resultIdx) {
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
								error(err) ;
							ok(result) ;
						} ;
					}
					return fn.apply(scope,args) ;
				}
			};
		};
		
		var stdJSLoader = require.extensions['.js'] ; 
		if (opts.useDirective) {
			require.extensions['.js'] = function(mod,filename) {
				var code,content = stripBOM(fs.readFileSync(filename, 'utf8'));
				try {
					var pr = nodent.parse(content,filename);
					for (var i=0; i<pr.ast.body.length; i++) {
						if (pr.ast.body[i] instanceof U2.AST_Directive && pr.ast.body[i].value==opts.useDirective) {
							return require.extensions[opts.extension](mod,filename) ;
						}
					}
				} catch (ex) {
					if (ex.constructor.name=="JS_Parse_Error") 
						reportParseException(ex,content,filename) ;
					console.log("NoDent JS: Warning - couldn't parse "+filename+" (line:"+ex.line+",col:"+ex.col+"). Reason: "+ex.message) ;
				}
				return stdJSLoader(mod,filename) ;
			} ;
		}
	
		require.extensions[opts.extension] = function(mod, filename) {
			try {
				var content = stripBOM(fs.readFileSync(filename, 'utf8'));
				var pr = nodent.parse(content,filename);
				nodent.asynchronize(pr) ;
				nodent.prettyPrint(pr) ;
				mod._compile(pr.code, pr.filename);
			} catch (ex) {
				if (ex.constructor.name=="JS_Parse_Error") 
					reportParseException(ex,content,filename) ;
				throw ex ;
			}
		};
	}
	
	opts.use.forEach(nodent.require) ;

	for (var k in opts) {
		if (!config.hasOwnProperty(k))
			throw new Error("NoDent: unknown option: "+k+"="+JSON.stringify(opts[k])) ;
		if (k!="use") 
			config[k] = opts[k] ;
	}
	configured = true ;
	return nodent ;
} ;
