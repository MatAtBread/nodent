#!/usr/bin/env node

/**
 * NoDent - Asynchronous JavaScript Language extensions for Node
 *
 * AST transforms and node loader extension
 */
var stdJSLoader ;
var smCache = {} ;
var SourceMapConsumer = require('source-map').SourceMapConsumer;
var fs = require('fs') ;
var outputCode = require('./lib/output') ;
var parser = require('./lib/parser') ;
var asynchronize = require('./lib/arboriculture').asynchronize ;

var directives = {
	useDirective:/^\s*['"]use\s+nodent['"]\s*;/,
	useES7Directive:/^\s*['"]use\s+nodent\-es7['"]\s*;/,
	usePromisesDirective:/^\s*['"]use\s+nodent\-promises?['"]\s*;/,
	useGeneratorsDirective:/^\s*['"]use\s+nodent\-generators?['"]\s*;/
};

// Config options, which relate to a specific instance of nodent and it's compiler/extension
// These defaults are also used by the '.js' extension compiler when a "use nodent" directive is present
var config = {
	log:function(msg){ console.warn("Nodent: "+msg) },		// Where to print errors and warnings. This can only be (re)set once
	augmentObject:false,									// Only one has to say 'yes'
	extension:'.njs',										// The 'default' extension
	dontMapStackTraces:false								// Only one has to say 'no'
} ;

var defaultCodeGenOpts = {
	sourcemap:true,
	$return:"$return",
	$error:"$error",
	$arguments:"$args",
	bindAwait:"$asyncbind",
	bindAsync:"$asyncbind",
	bindLoop:"$asyncbind"
};

/* Extract compiler options from code (either a string or AST) */
function parseCompilerOptions(code,logger) {
	function matches(str,match){
		if (!match)
			return false ;
		if (typeof match==="string")
			return match==str ;
		if ("test" in match)
			return match.test(str) ;
	}

	var parseOpts = {} ;

	if (typeof code=="string") {
		parseOpts = {
				promises: !!code.match(directives.usePromisesDirective),
				es7: !!code.match(directives.useES7Directive),
				generators: !!code.match(directives.useGeneratorsDirective)
		} ;
		if (parseOpts.promises)
			parseOpts.es7 = true ;
	} else {
		// code is an AST
		for (var i=0; i<pr.ast.body.length; i++) {
			if (code.body[i].type==='ExpressionStatement' && code.body[i].expression.type==='Literal') {
				var test = "'"+code.body[i].value+"'" ;
				parseOpts.promises = matches(test,directives.usePromisesDirective) ;
				parseOpts.es7 = parseOpts.promises || matches(test,directives.useES7Directive) ;
				parseOpts.generators = matches(test,directives.useGeneratorsDirective) ;
			}
		}
	}

	if (parseOpts.promises || parseOpts.es7 || parseOpts.generators) {
		if ((parseOpts.promises || parseOpts.es7) && parseOpts.generators) {
			logger("No valid 'use nodent*' directive, assumed -es7 mode") ;
			parseOpts = {es7:true} ;
		}

		// Fill in any default codeGen options
		for (var k in defaultCodeGenOpts) {
			if (!(k in parseOpts))
				parseOpts[k] = defaultCodeGenOpts[k] ;
		}

		return parseOpts ;
	}
	return null ; // No valid nodent options
}

function stripBOM(content) {
	// Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
	// because the buffer-to-string conversion in `fs.readFileSync()`
	// translates it to FEFF, the UTF-16 BOM.
	if (content.charCodeAt(0) === 0xFEFF) {
		content = content.slice(1);
	}
	if (content.substring(0,2) === "#!") {
		content = content.slice(content.indexOf("\n"));
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

/* Initialize global things - unrelated to config options */
function initEnvironment() {
	// Initialize global/environment things
	if (!initialize.configured) {
		initialize.configured = true ;
		Object.defineProperties(Function.prototype,{
			"$asyncbind":{
				value:$asyncbind,
				writeable:true,
				enumerable:false,
				configurable:true
			},
			"$asyncspawn":{
				value:$asyncspawn,
				writeable:true,
				enumerable:false,
				configurable:true
			},
			"noDentify":{
				value:noDentify,
				configurable:true,
				enumerable:false,
				writable:true
			}
		}) ;
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
 * @params
 * idx			The argument index that is the 'callback'. 'undefined' for the final parameter
 * errorIdx		The argument index of the callback that holds the error. 'undefined' for no error value
 * resultIdx 	The argument index of the callback that holds the result. 'undefined' for the argument after the errorIdx (errorIdx != undefined)
 * promiseProvider	For promises, set this to the module providing Promises.
 */
function noDentify(idx,errorIdx,resultIdx,promiseProvider) {
	promiseProvider = promiseProvider || Thenable ;
	var fn = this ;
	return function() {
		var scope = this ;
		var args = Array.prototype.slice.apply(arguments) ;
		var resolver = function(ok,error) {
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
		return new promiseProvider(resolver) ;
	};
}

function compileNodentedFile(nodent,logger) {
	return function(mod, filename, parseOpts) {
		var content = stripBOM(fs.readFileSync(filename, 'utf8'));
		var pr = nodent.parse(content,filename,parseOpts);
		parseOpts = parseOpts || parseCompilerOptions(pr.ast,logger) ;
		nodent.asynchronize(pr,undefined,parseOpts,logger) ;
		nodent.prettyPrint(pr,parseOpts) ;
		mod._compile(pr.code, pr.filename);
	}
};

// Things that DON'T depend on initOpts (or config, and therefore nodent)
function asyncify(promiseProvider) {
	promiseProvider = promiseProvider || Thenable ;
	return function(obj,filter,suffix) {
		if (Array.isArray(filter)) {
			var names = filter ;
			filter = function(k,o) {
				return names.indexOf(k)>=0 ;
			}
		} else {
			filter = filter || function(k,o) {
				return (!k.match(/Sync$/) || !(k.replace(/Sync$/,"") in o)) ;
			};
		}

		if (!suffix)
			suffix = "" ;

		var o = Object.create(obj) ;
		for (var j in o) (function(){
			var k = j ;
			try {
				if (typeof obj[k]==='function' && (!o[k+suffix] || !o[k+suffix].isAsync) && filter(k,o)) {
					o[k+suffix] = function() {
						var a = Array.prototype.slice.call(arguments) ;
						var resolver = function($return,$error) {
							var cb = function(err,ok){
								if (err)
									return $error(err) ;
								switch (arguments.length) {
								case 0: return $return() ;
								case 2: return $return(ok) ;
								default: return $return(Array.prototype.slice.call(arguments,1)) ;
								}
							} ;
							// If more args were supplied than declared, push the CB
							if (a.length > obj[k].length) {
								a.push(cb) ;
							} else {
								// Assume the CB is the final arg
								a[obj[k].length-1] = cb ;
							}
							var ret = obj[k].apply(obj,a) ;
							/* EXPERIMENTAL !!
							if (ret !== undefined) {
								$return(ret) ;
							}
							 */
						} ;
						return new promiseProvider(resolver) ;
					}
					o[k+suffix].isAsync = true ;
				}
			} catch (ex) {
				// Log the fact that we couldn't augment this member??
			}
		})() ;
		o["super"] = obj ;
		return o ;
	}
};

function prettyPrint(pr,opts) {
	var map ;
	var filepath = pr.filename.split("/") ;
	var filename = filepath.pop() ;

// XXX: Need an option to switch sourcemaps on and off
	var out = outputCode(pr.ast,(opts && opts.sourcemap)?{map:{
		file: filename, //+"(original)",
		sourceMapRoot: filepath.join("/"),
		sourceContent: pr.origCode
	}}:null) ;

	try {
		var mapUrl = "" ;
		var jsmap = out.map.toJSON();
		if (jsmap) {
			pr.sourcemap = jsmap ;
			smCache[pr.filename] = {map:jsmap,smc:new SourceMapConsumer(jsmap)} ;
			mapUrl = "\n\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,"
				+btoa(JSON.stringify(jsmap))+"\n" ;
		}
		pr.code = out.code+mapUrl ;
	} catch (ex) {
		pr.code = out ;
	}
}

function parseCode(code,origFilename,__sourceMapping,opts) {
	var r = { origCode:code.toString(), filename:origFilename } ;
	try {
		r.ast = parser.parse(r.origCode) ;
		return r ;
	} catch (ex) {
		if (ex instanceof SyntaxError) {
			var l = r.origCode.substr(ex.pos-ex.loc.column) ;
			l = l.split("\n")[0] ;
			ex.message += " (nodent)\n"+l+"\n"+l.replace(/[\S ]/g,"-").substring(0,ex.loc.column)+"^" ;
			ex.stack = "" ;
		}
		throw ex ;
	}
}


function $asyncbind(self,catcher) {
	var resolver = this ;
	var context = new Error() ;
	if (catcher) {
		var wrap = catcher ;
		catcher = function(ex){
			if (context) {
				ex.stack += (context.stack.split("\n").slice(2).map((s)=>s.replace(/^(\s*)at /g,"\n$1at await ")).join("")) ;
//				ex.stack += context.stack.split("\n")[4].replace(/^(\s*)at /g,"\n$1at await ") ;
				context = null ;
			}
			wrap(ex) ;
		} ;

		function thenable(result,error){
			try {
				return (result instanceof Object) && ('then' in result) && typeof result.then==="function"
					? result.then(thenable,catcher) : resolver.call(self,result,error||catcher);
			} catch (ex) {
				return (error||catcher)(ex);
			}
		} ;
		thenable.then = thenable ;
		return thenable ;
	} else {
		var then = function(result,error) {
			return resolver.call(self,result,error) ;
		} ;
		then.then = then ;
		return then ;
	}
}

function $asyncspawn(promiseProvider,self) {
	var genF = this ;
    return new promiseProvider(function enough(resolve, reject) {
        var gen = genF.call(self, resolve, reject);
        function step(fn,arg) {
            var next;
            try {
                next = fn.call(gen,arg);
	            if(next.done) {
	            	if (next.value !== resolve) {
	    	            if (next.value && next.value===next.value.then)
	    	            	return next.value(resolve,reject) ;
		            	resolve && resolve(next.value);
		            	resolve = null ;
	            	}
	                return;
	            }

	            if (next.value.then) {
		            next.value.then(function(v) {
		                step(gen.next,v);
		            }, function(e) {
		                step(gen.throw,e);
		            });
	            } else {
	            	step(gen.next,next.value);
	            }
            } catch(e) {
            	reject && reject(e);
            	reject = null ;
                return;
            }
        }
        step(gen.next);
    });
}

function Thenable(thenable) {
	return thenable.then = thenable ;
};

function isThenable(obj) {
	return (obj instanceof Object) && ('then' in obj) && typeof obj.then==="function";
}

/* NodentCompiler prototypes, that refer to 'this' */
function requireCover(cover,opts) {
	if (!this.covers[cover]) {
		if (cover.indexOf("/")>=0)
			this.covers[cover] = require(cover) ;
		else
			this.covers[cover] = require("./covers/"+cover);
	}
	return this.covers[cover](this,opts) ;
}

function compile(code,origFilename,__sourceMapping,opts) {
	opts = opts || {} ;
	if (opts.promises)
		opts.es7 = true ;

	// Fill in any default codeGen options
	for (var k in defaultCodeGenOpts) {
		if (!(k in opts))
			opts[k] = defaultCodeGenOpts[k] ;
	}

	var pr = this.parse(code,origFilename,null,opts);
	this.asynchronize(pr,null,opts,this.logger) ;
	this.prettyPrint(pr,opts) ;
	return pr ;
}

function generateRequestHandler(path, matchRegex, options) {
	var cache = {} ;
	var compiler = this ;

	if (!matchRegex)
		matchRegex = /\.njs$/ ;
	if (!options)
		options = {} ;

	return function (req, res, next) {
		if (cache[req.url]) {
			res.setHeader("Content-Type", cache[req.url].contentType);
			options.setHeaders && options.setHeaders(res) ;
			res.write(cache[req.url].output) ;
			res.end();
			return ;
		}

		if (!req.url.match(matchRegex) && !(options.htmlScriptRegex && req.url.match(options.htmlScriptRegex))) {
			return next && next() ;
		}

		function sendException(ex) {
			res.statusCode = 500 ;
			res.write(ex.toString()) ;
			res.end() ;
		}

		var filename = path+req.url ;
		if (options.extensions && !fs.existsSync(filename)) {
			for (var i=0; i<options.extensions.length; i++) {
				if (fs.existsSync(filename+"."+options.extensions[i])) {
					filename = filename+"."+options.extensions[i] ;
					break ;
				}
			}
		}
		fs.readFile(filename,function(err,content){
			if (err) {
				return sendException(err) ;
			} else {
				try {
					var pr,contentType ;
					if (options.htmlScriptRegex && req.url.match(options.htmlScriptRegex)) {
						pr = require('./htmlScriptParser')(compiler,content.toString(),req.url,options) ;
						contentType = "text/html" ;
					} else {
						pr = compiler.compile(content.toString(),req.url,2,options.compiler).code;
						contentType = "application/javascript" ;
						if (options.runtime)
							pr = "Function.prototype.$asyncbind = "+$asyncbind.toString()+";\n"+pr ;
					}
					res.setHeader("Content-Type", contentType);
					if (options.enableCache)
						cache[req.url] = {output:pr,contentType:contentType} ;
					options.setHeaders && options.setHeaders(res) ;
					res.write(pr) ;
					res.end();
				} catch (ex) {
					return sendException(ex) ;
				}
			}
		}) ;
	};
};

function NodentCompiler(members) {
	this.covers = {} ;
	for (var k in members)
		this[k] = members[k] ;
}

NodentCompiler.prototype.version =  require("./package.json").version ;
NodentCompiler.prototype.Thenable =  Thenable ;
NodentCompiler.prototype.isThenable =  isThenable ;
NodentCompiler.prototype.asyncify =  asyncify ;
NodentCompiler.prototype.require =  requireCover ;
NodentCompiler.prototype.generateRequestHandler = generateRequestHandler ;
// Exported so they can be transported to a client
NodentCompiler.prototype.$asyncspawn =  $asyncspawn ;
NodentCompiler.prototype.$asyncbind =  $asyncbind ;
// Exported ; but not to be used lightly!
NodentCompiler.prototype.parse =  parseCode ;
NodentCompiler.prototype.compile =  compile ;
NodentCompiler.prototype.asynchronize =  asynchronize ;
NodentCompiler.prototype.prettyPrint =  prettyPrint ;
Object.defineProperty(NodentCompiler.prototype,"Promise",{
	get:function (){
		initOpts.log("Warning: nodent.Promise is deprecated. Use nodent.Thenable");
		return Thenable;
	},
	enumerable:false,
	configurable:false
}) ;

/* Construct a 'nodent' object - combining logic and options */
function initialize(initOpts){
	// Validate the options
/* initOpts:{
 * 		log:function(msg),
 * 		augmentObject:boolean,
 * 		extension:string?
 * 		dontMapStackTraces:boolean
 */
	if (!initOpts)
		initOpts = {} ;

	// Fill in any missing options with their default values
	Object.keys(config).forEach(function(k){
		if (!(k in initOpts))
			initOpts[k] = config[k] ;
	}) ;

	// Throw an error for any options we don't know about
	for (var k in initOpts) {
		if (k==="use")
			continue ; // deprecated
		if (!config.hasOwnProperty(k))
			throw new Error("NoDent: unknown option: "+k+"="+JSON.stringify(initOpts[k])) ;
	}

	// "Global" options:
	// If anyone wants to augment Object, do it. The augmentation does not depend on the config options
	if (initOpts.augmentObject) {
		Object.defineProperties(Object.prototype,{
			"asyncify":{
				value:function(promiseProvider,filter,suffix){
					return asyncify(promiseProvider)(this,filter,suffix)
				},
				writeable:true,
				configurable:true
			},
			"isThenable":{
				value:isThenable,
				writeable:true,
				configurable:true
			}
		}) ;
	}

	// If anyone wants to mapStackTraces, do it. The augmentation does not depend on the config options
	if (!initOpts.dontMapStackTraces) {
		// This function is part of the V8 stack trace API, for more info see:
		// http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
		Error.prepareStackTrace = function(error, stack) {
			function mappedTrace(frame) {
				var source = frame.getFileName();
				if (source && smCache[source]) {
					var position = smCache[source].smc.originalPositionFor({
						line: frame.getLineNumber(), 
						column: frame.getColumnNumber()
					});
					if (position && position.line) {
						var desc = frame.toString() ;
						return '\n    at '
							+ desc.substring(0,desc.length-1)
							+ " => \u2026"+position.source+":"+position.line+":"+position.column
							+ (frame.getFunctionName()?")":"");
					}
				}
				return '\n    at '+frame;
			}
			return error + stack.map(mappedTrace).join('');
		}
	}

	// Create a new compiler
	var nodent = new NodentCompiler({
		logger: initOpts.log
	}) ;

	/**
	 * We need a global to handle funcbacks for which no error handler has ever been defined.
	 */
	if (!(defaultCodeGenOpts.$error in global)) {
		global[defaultCodeGenOpts.$error] = function(err) {
			throw err ;
		};
	}

	/* If we've not done it before, create a compiler for '.js' scripts */
	if (!stdJSLoader) {
		stdJSLoader = require.extensions['.js'] ;
		var stdCompiler = compileNodentedFile(new NodentCompiler({logger:initOpts.log}),initOpts.log) ;
		require.extensions['.js'] = function(mod,filename) {
			var content = stripBOM(fs.readFileSync(filename, 'utf8'));
			var parseOpts = parseCompilerOptions(content,initOpts.log) ;
			if (parseOpts)
				return stdCompiler(mod,filename,parseOpts) ;
			return stdJSLoader(mod,filename) ;
		} ;
	}

	/* If the initOpts specified a file extension, use this compiler for it */
	if (initOpts.extension && !require.extensions[initOpts.extension]) {
		require.extensions[initOpts.extension] = compileNodentedFile(nodent,initOpts.log) ;
	}

	// Finally, load any required covers
	if (initOpts.use) {
		if (Array.isArray(initOpts.use)) {
			initOpts.log("Warning: nodent({use:[...]}) is deprecated. Use nodent.require(module,options)\n"+(new Error().stack).split("\n")[2]);
			if (initOpts.use.length) {
				initOpts.use.forEach(function(x){
					nodent[x] = nodent.require(x) ;
				}) ;
			}
		} else {
			initOpts.log("Warning: nodent({use:{...}}) is deprecated. Use nodent.require(module,options)\n"+(new Error().stack).split("\n")[2]);
			Object.keys(initOpts.use).forEach(function(x){
				nodent[x] = nodent.require(x,initOpts.use[x])
			}) ;
		}
	}
	return nodent ;
} ;

initEnvironment() ;

initialize.setDefaultCompileOptions = function(o) {
	Object.keys(o).forEach(function(k){
		if (!(k in defaultCodeGenOpts))
			throw new Error("NoDent: unknown option: "+k) ;
		defaultCodeGenOpts[k] = o[k] ;
	}) ;
}
initialize.asyncify = asyncify ;
initialize.Thenable = Thenable ;
/* Export these so that we have the opportunity to set the options for the default .js parser */
initialize.defaultConfig = config ;

module.exports = initialize ;

/* If invoked as the top level module, read the next arg and load it */
if (require.main===module && process.argv.length>=3) {
	var initOpts = (process.env.NODENT_OPTS && JSON.parse(process.env.NODENT_OPTS)) ;
	initialize.setDefaultCompileOptions({sourcemap:process.argv.indexOf("--sourcemap")>=0});
	var nodent = initialize(initOpts) ;
	var path = require('path') ;
	var n = 2 ;

	while (n<process.argv.length) {
		var opt = process.argv[n] ;
		switch (opt) {
		case "--sourcemap":
			n += 1 ;
			break ;
		case "--out":
		case "--ast":
		case "--minast":
		case "--parseast":
			// Compile & output, but don't require
			var filename = path.resolve(process.argv[n+1]) ;
			var content = stripBOM(fs.readFileSync(filename, 'utf8'));
			var parseOpts = parseCompilerOptions(content,nodent.logger) ;
			if (!parseOpts) {
				parseOpts = {es7:true} ;
				console.warn("/* "+filename+": No 'use nodent*' directive, assumed -es7 mode */") ;
			}

			var pr = nodent.parse(content,filename,parseOpts);
			if (opt!="--parseast")
				nodent.asynchronize(pr,undefined,parseOpts,nodent.logger) ;
			switch (opt) {
			case "--out":
				nodent.prettyPrint(pr,parseOpts) ;
				console.log(pr.code) ;
				return ;
			case "--ast":
				console.log(JSON.stringify(pr.ast,function(key,value){ return key[0]==="$"?undefined:value},0)) ;
				return ;
			case "--minast":
			case "--parseast":
				console.log(JSON.stringify(pr.ast,function(key,value){
					return key[0]==="$" || key.match(/start|end|loc/)?undefined:value
				},2,null)) ;
				return ;
			}
			return;
		default:
			// Compile & require
			var mod = path.resolve(process.argv[n]) ;
			return require(mod);
		}
	}
}
