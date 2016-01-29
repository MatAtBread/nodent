#!/usr/bin/env node

/**
 * NoDent - Asynchronous JavaScript Language extensions for Node
 *
 * AST transforms and node loader extension
 */
var stdJSLoader ;
var smCache = {} ;
var fs = require('fs') ;
var outputCode = require('./lib/output') ;
var parser = require('./lib/parser') ;
var treeSurgeon = require('./lib/arboriculture') ;

// Config options used to control the run-time behaviour of the compiler
var config = {
	log:function(msg){ console.warn("Nodent: "+msg) },		// Where to print errors and warnings
	augmentObject:false,									// Only one has to say 'yes'
	extension:'.njs',										// The 'default' extension
	dontMapStackTraces:false,								// Only one has to say 'no'
	asyncStackTrace:false,
	babelTree:false,
	dontInstallRequireHook:false
} ;

// Code generation options, which are determined by the "use nodent"; directive. Specifically,
// the (optional) portion as in "use nodent<-option-set>"; is used to select a compilation
// behaviour on a file-by-file basis. There are preset option sets called "es7", "promise(s)"
// and "generators" (which cannot be over-written). Others can be specified via the
// 'setCompileOptions(name,options)' call, or via the 'nodent:{directive:{'name':{...}}}' entry in the
// current project's package.json. In the latter's case, the name 'default' is also reserved and
// is used for a bare 'use nodent' driective with no project-specific extension.
// Finally, the 'use nodent' directive can be followed by a JSON encoded set of options, for example:
//		'use nodent-es7 {"wrapAwait":true}';
//		'use nodent {"wrapAwait":true,"promise":true}';
//		'use nodent-generators {"parser":{"sourceType":"module"}}';
//
// The order of application of these options is:
//		initialCodeGenOpts (hard-coded)
//		named by the 'use nodent-OPTION', as read from the package.json
//		named by the 'use nodent-OPTION', as set by the setCompileOptions (or setDefaultCompileOptions)
//		set within the directive as a JSON-encoded extension

var initialCodeGenOpts = {
	wrapAwait:null,
	mapStartLine:0,
	sourcemap:true,
	parser:{sourceType:'script'},
	$return:"$return",
	$error:"$error",
	$arguments:"$args",
	$asyncspawn:"$asyncspawn",
	$asyncbind:"$asyncbind",
	/* deprecated
	bindAwait:"$asyncbind",
	bindAsync:"$asyncbind",
	bindLoop:"$asyncbind", */
	generatedSymbolPrefix:"$",
	$makeThenable:'$makeThenable'
};

function copyObj(a){
	var o = {} ;
	a.forEach(function(b){
		if (b && typeof b==='object')
			for (k in b)
				o[k] = b[k]  ;
	}) ;
	return o ;
};

var defaultCodeGenOpts = Object.create(initialCodeGenOpts, {es7:{value:true,writeable:true,enumerable:true}}) ; 
var optionSets = {
	default:defaultCodeGenOpts,
	es7:Object.create(defaultCodeGenOpts),
	promise:Object.create(defaultCodeGenOpts,{
		promises:{value:true,writeable:true,enumerable:true}
	}),
	generator:Object.create(defaultCodeGenOpts,{
		generators:{value:true,writeable:true,enumerable:true},
		es7:{value:false,writeable:true,enumerable:true},
	})
};
optionSets.promises = optionSets.promise ;
optionSets.generators = optionSets.generator ;

function globalErrorHandler(err) {
	throw err ;
}

/* Extract compiler options from code (either a string or AST) */
var useDirective = /^\s*['"]use\s+nodent-?([a-zA-Z0-9]*)?(\s*.*)?['"]\s*;/

function noLogger(){}

function parseCompilerOptions(code,log) {
	var regex, set, parseOpts = {} ;
	if (typeof code=="string") {
		if (regex = code.match(useDirective)) {
			set = regex[1] || 'default' ;
		}
	} else { // code is an AST
		for (var i=0; i<code.body.length; i++) {
			if (code.body[i].type==='ExpressionStatement' && code.body[i].expression.type.match(/^(StringLiteral|Literal)$/)) {
				var test = "'"+code.body[i].value+"'" ;
				if (regex = test.match(useDirective)) {
					set = regex[1] || 'default' ;
					break ;
				}
			}
		}
	}
	if (!regex)
		return null ;

	if (set) {
		try {
			var packageOptions = JSON.parse(fs.readFileSync(__dirname+"/../../package.json")).nodent.directive[set] ;
		} catch(ex) {
			// Meh
		}
	}
	try {
		parseOpts = copyObj([optionSets[set],packageOptions,regex[2] && JSON.parse(regex[2])]);
	} catch(ex) {
		log("Invalid literal compiler option:"+regex[2]);
	}

	if (parseOpts.promises || parseOpts.es7 || parseOpts.generators) {
		if ((parseOpts.promises || parseOpts.es7) && parseOpts.generators) {
			log("No valid 'use nodent' directive, assumed -es7 mode") ;
			parseOpts = optionSets.es7 ;
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

/**
 * NoDentify (make async) a general function.
 * The format is function(a,b,cb,d,e,f){}.noDentify(cbIdx,errorIdx,resultIdx) ;
 * for example:
 * 		http.aGet = http.get.noDentify(1) ;	// The 1st argument (from zero) is the callback. errorIdx is undefined (no error)
 *
 * The function is transformed from:
 * 		http.get(opts,function(result){}) ;
 * to:
 * 		http.aGet(opts).then(function(result){}) ;
 *
 * @params
 * idx			The argument index that is the 'callback'. 'undefined' for the final parameter
 * errorIdx		The argument index of the callback that holds the error. 'undefined' for no error value
 * resultIdx 	The argument index of the callback that holds the result.
 * 				'undefined' for the argument after the errorIdx (errorIdx != undefined)
 * 				[] returns all the arguments
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
					if (err)
						return error(err) ;
					if (Array.isArray(resultIdx) && resultIdx.length===0)
						return ok(arguments) ;
					var result = arguments[resultIdx===undefined?errorIdx+1:resultIdx] ;
					return ok(result) ;
				} ;
			}
			return fn.apply(scope,args) ;
		}
		return new promiseProvider(resolver) ;
	};
}

function compileNodentedFile(nodent,log) {
	return function(mod, filename, parseOpts) {
		var content = stripBOM(fs.readFileSync(filename, 'utf8'));
		var pr = nodent.parse(content,filename,parseOpts);
		parseOpts = parseOpts || parseCompilerOptions(pr.ast,log) ;
		nodent.asynchronize(pr,undefined,parseOpts,log) ;
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

	var out = outputCode(pr.ast,(opts && opts.sourcemap)?{map:{
		startLine: opts.mapStartLine || 0,
		file: filename+"(original)",
		sourceMapRoot: filepath.join("/"),
		sourceContent: pr.origCode
	}}:null, pr.origCode) ;

	if (opts && opts.sourcemap){
	    try {
	        var mapUrl = "" ;
	        var jsmap = out.map.toJSON();
	        if (jsmap) {
	            // require an expression to defeat browserify
	            var SourceMapConsumer = require('source-map').SourceMapConsumer;
	            pr.sourcemap = jsmap ;
	            smCache[pr.filename] = {map:jsmap,smc:new SourceMapConsumer(jsmap)} ;
	            mapUrl = "\n\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,"
	                +btoa(JSON.stringify(jsmap))+"\n" ;
	        }
	        pr.code = out.code+mapUrl ;
	    } catch (ex) {
	        pr.code = out ;
	    }
	} else {
        pr.code = out ;
	}
	return pr ;
}

function parseCode(code,origFilename,__sourceMapping,opts) {
	if (typeof __sourceMapping==="object" && opts===undefined)
		opts = __sourceMapping ;

	var r = { origCode:code.toString(), filename:origFilename } ;
	try {
		r.ast = parser.parse(r.origCode, opts && opts.parser) ;
		if (opts.babelTree) {
			parser.treeWalker(r.ast,function(node,descend,path){
				if (node.type==='Literal')
					path[0].replace(treeSurgeon.babelLiteralNode(node.value)) ;
				descend() ;
			}) ;
		}
		return r ;
	} catch (ex) {
		if (ex instanceof SyntaxError) {
			var l = r.origCode.substr(ex.pos-ex.loc.column) ;
			l = l.split("\n")[0] ;
			ex.message += " "+origFilename+" (nodent)\n"+l+"\n"+l.replace(/[\S ]/g,"-").substring(0,ex.loc.column)+"^" ;
			ex.stack = "" ;
		}
		throw ex ;
	}
}

function $asyncbind(self,catcher) {
	var resolver = this ;
	if (catcher) {
		if ($asyncbind.wrapAsyncStack)
			catcher = $asyncbind.wrapAsyncStack(catcher) ;
		var thenable = function thenable(result,error){
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

function wrapAsyncStack(catcher) {
	var context = {} ;
	Error.captureStackTrace(context,$asyncbind) ;
	return function wrappedCatch(ex){
		if (ex instanceof Error && context) {
			try {
				ex.stack = //+= "\n\t...\n"+
					ex.stack.split("\n").slice(0,3)
					.filter(function(s){
						return !s.match(/^\s*at.*nodent\.js/) ;
					}).join("\n")+
					ex.stack.split("\n").slice(3).map(function(s){return "\n    "+s}).join("")+
					context.stack.split("\n").slice(2)
					.filter(function(s){
						return !s.match(/^\s*at.*nodent\.js/) ;
					})
					.map(function(s,idx){
						return idx?"\n"+s:s.replace(/^(\s*)at /g,"\n$1await ")
					}).join("") ;
			} catch (stackError) {
				// Just fall through and don't modify the stack
			}
			context = null ;
		}
		return catcher.call(this,ex) ;
	} ;
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
Thenable.resolve = function(v){
	return ((v instanceof Object) && ('then' in v) && typeof v.then==="function")?v:{then:function(resolve){return resolve(v)}};
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
	if (typeof __sourceMapping==="object" && opts===undefined)
		opts = __sourceMapping ;

	opts = opts || {} ;

	// Fill in any default codeGen options
	for (var k in defaultCodeGenOpts) {
		if (!(k in opts))
			opts[k] = defaultCodeGenOpts[k] ;
	}

	var pr = this.parse(code,origFilename,null,opts);
	this.asynchronize(pr,null,opts,this.log || noLogger) ;
	this.prettyPrint(pr,opts) ;
	return pr ;
}

function generateRequestHandler(path, matchRegex, options) {
	var cache = {} ;
	var compiler = this ;

	if (!matchRegex)
		matchRegex = /\.njs$/ ;
	if (!options)
		options = {compiler:{}} ;
	else if (!options.compiler)
		options.compiler = {} ;
	var compilerOptions = copyObj([initialCodeGenOpts,options.compiler]) ;

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
						if (options.runtime) {
							pr = "Function.prototype."+compilerOptions.$asyncbind+" = "+$asyncbind.toString()+";" ;
							if (compilerOptions.generators)
								pr += "Function.prototype."+compilerOptions.$asyncspawn+" = "+$asyncspawn.toString()+";" ;
							if (compilerOptions.wrapAwait && !compilerOptions.promises)
								pr += "Object."+compilerOptions.$makeThenable+" = "+Thenable.resolve.toString()+";" ;
							compilerOptions.mapStartLine = pr.split("\n").length ;
							pr += "\n";
						} else {
							pr = "" ;
						}
						pr += compiler.compile(content.toString(),req.url,null,compilerOptions).code;
						contentType = "application/javascript" ;
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
	this._ident = NodentCompiler.prototype.version+"_"+Math.random() ;
	this.setOptions(members) ;
}

NodentCompiler.prototype.setOptions = function(members){
	this.log = members.log || this.log || noLogger;
	this.options = copyObj([this.options,members]) ;
	delete this.options.log ;
	return this ;
};
NodentCompiler.prototype.version =  require(__dirname+"/package.json").version ;
NodentCompiler.prototype.Thenable =  Thenable ;
NodentCompiler.prototype.isThenable =  isThenable ;
NodentCompiler.prototype.asyncify =  asyncify ;
NodentCompiler.prototype.require =  requireCover ;
NodentCompiler.prototype.generateRequestHandler = generateRequestHandler ;
// Exported so they can be transported to a client
NodentCompiler.prototype.$asyncspawn =  $asyncspawn ;
NodentCompiler.prototype.$asyncbind =  $asyncbind ;
// Exported ; but not to be used lightly!
NodentCompiler.prototype.parse = parseCode ;
NodentCompiler.prototype.compile =  compile ;
NodentCompiler.prototype.asynchronize =  treeSurgeon.asynchronize ;
NodentCompiler.prototype.prettyPrint =  prettyPrint ;
NodentCompiler.prototype.parseCompilerOptions =  parseCompilerOptions ;
NodentCompiler.prototype.getDefaultCompileOptions = undefined ;

Object.defineProperty(NodentCompiler.prototype,"Promise",{
	get:function (){
		initOpts.log("Warning: nodent.Promise is deprecated. Use nodent.Thenable instead");
		return Thenable;
	},
	enumerable:false,
	configurable:false
}) ;

function prepareMappedStackTrace(error, stack) {
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

// Set the 'global' references to the (backward-compatible) versions
// required by the current version of Nodent
function setGlobalEnvironment(initOpts) {
	var codeGenOpts = defaultCodeGenOpts ;
	/*
	Object.$makeThenable
	Object.prototype.isThenable
	Object.prototype.asyncify
	Function.prototype.noDentify
	Function.prototype.$asyncspawn
	Function.prototype.$asyncbind
	Error.prepareStackTrace
	global[defaultCodeGenOpts.$error]
	*/

	var augmentFunction = {} ;
	augmentFunction[defaultCodeGenOpts.$asyncbind] = {
		value:$asyncbind,
		writable:true,
		enumerable:false,
		configurable:true
	};
	augmentFunction[defaultCodeGenOpts.$asyncspawn] = {
		value:$asyncspawn,
		writable:true,
		enumerable:false,
		configurable:true
	};
	augmentFunction.noDentify = {
		value:noDentify,
		configurable:true,
		enumerable:false,
		writable:true
	} ;
	Object.defineProperties(Function.prototype,augmentFunction) ;

	/**
	 * We need a global to handle funcbacks for which no error handler has ever been defined.
	 */
	if (!(defaultCodeGenOpts[defaultCodeGenOpts.$error] in global)) {
		global[defaultCodeGenOpts[defaultCodeGenOpts.$error]] = globalErrorHandler ;
	}

	if (initOpts.asyncStackTrace)
		$asyncbind.wrapAsyncStack = wrapAsyncStack ;

	// "Global" options:
	// If anyone wants to augment Object, do it. The augmentation does not depend on the config options
	if (initOpts.augmentObject) {
		Object.defineProperties(Object.prototype,{
			"asyncify":{
				value:function(promiseProvider,filter,suffix){
					return asyncify(promiseProvider)(this,filter,suffix)
				},
				writable:true,
				configurable:true
			},
			"isThenable":{
				value:function(){ return isThenable(this) },
				writable:true,
				configurable:true
			}
		}) ;
	}

	Object[defaultCodeGenOpts.$makeThenable] = Thenable.resolve ;
}

/* Construct a 'nodent' object - combining logic and options */
var compiler ;
function initialize(initOpts){
	// Validate the options
/* initOpts:{
 * 		log:function(msg),
 * 		augmentObject:boolean,
 * 		extension:string?
 * 		dontMapStackTraces:boolean
 * 		asyncStackTrace:boolean
 */
	if (!initOpts)
		initOpts = {} ;
	else {
		// Throw an error for any options we don't know about
		for (var k in initOpts) {
			if (k==="use")
				continue ; // deprecated
			if (!config.hasOwnProperty(k))
				throw new Error("NoDent: unknown option: "+k+"="+JSON.stringify(initOpts[k])) ;
		}
	}


	if (compiler) {
		compiler.setOptions(initOpts);
	} else {
		// Fill in any missing options with their default values
		Object.keys(config).forEach(function(k){
			if (!(k in initOpts))
				initOpts[k] = config[k] ;
		}) ;
		compiler = new NodentCompiler(initOpts) ;
	}

	// If anyone wants to mapStackTraces, do it. The augmentation does not depend on the config options
	if (!initOpts.dontMapStackTraces) {
		// This function is part of the V8 stack trace API, for more info see:
		// http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
		Error.prepareStackTrace = prepareMappedStackTrace ;
	}

	setGlobalEnvironment(initOpts) ;

	/* If we've not done it before, create a compiler for '.js' scripts */
	// Create a new compiler

	var nodentLoaders = [];
	function compareSemVer(a,b) {
		a = a.split('.') ;
		b = b.split('.') ;
		for (var i=0;i<3;i++) {
			if (a[i]<b[i]) return -1 ;
			if (a[i]>b[i]) return 1 ;
		}
		return 0 ;
	}

	if (!initOpts.dontInstallRequireHook) {
		if (!stdJSLoader) {
			stdJSLoader = require.extensions['.js'] ;
			var stdCompiler = compileNodentedFile(compiler,initOpts.log) ;
			require.extensions['.js'] = versionAwareNodentJSLoader ;
			function versionAwareNodentJSLoader(mod,filename) {
				if (filename.match(/nodent\/nodent.js$/)) {
					var downLevel = {path:filename.replace(/\/node_modules\/nodent\/nodent.js$/,"")} ;
					if (downLevel.path) {
						downLevel.version = JSON.parse(fs.readFileSync(filename.replace(/nodent\.js$/,"package.json"))).version ;
						// Load the specified nodent
						stdJSLoader(mod,filename) ;

						// If the version of nodent we've just loaded is lower than the
						// current (version-aware) version, hook the initialzer
						// so we can replace the JS loader after it's been run.
						if (compareSemVer(downLevel.version,NodentCompiler.prototype.version)<0) {
							downLevel.originalNodentLoader = mod.exports ;
							mod.exports = function(){
								var previousJSLoader = require.extensions['.js'] ;
								var defaultNodentInstance = downLevel.originalNodentLoader.apply(this,arguments) ;
								downLevel.jsCompiler = require.extensions['.js'] ;
								require.extensions['.js'] = previousJSLoader ;
								setGlobalEnvironment(initOpts) ;
								return defaultNodentInstance ;
							} ;
							Object.keys(downLevel.originalNodentLoader).forEach(function(k){
								mod.exports[k] = downLevel.originalNodentLoader[k] ;
							}) ;
							nodentLoaders.push(downLevel) ;
							nodentLoaders = nodentLoaders.sort(function(a,b){
								return b.path.length - a.path.length ;
							}) ;
						}
					}
				} else {
					// The the appropriate loader for this file
					for (var n=0; n<nodentLoaders.length; n++) {
						if (filename.slice(0,nodentLoaders[n].path.length)==nodentLoaders[n].path) {
							//console.log("Using nodent@",nodentLoaders[n].version,"to load",filename) ;
							return nodentLoaders[n].jsCompiler.apply(this,arguments) ;
						}
					}

					var content = stripBOM(fs.readFileSync(filename, 'utf8'));
					var parseOpts = parseCompilerOptions(content,initOpts.log) ;
					if (parseOpts) {
						return stdCompiler(mod,filename,parseOpts) ;
					}
					return stdJSLoader(mod,filename) ;
				}
			} ;
		}

		/* If the initOpts specified a file extension, use this compiler for it */
		if (initOpts.extension) {
			if (Array.isArray(initOpts.extension)) {
				initOpts.extension.forEach(registerExtension) ;
			} else {
				registerExtension(initOpts.extension) ;
			}

			function registerExtension(extension) {
				 if (require.extensions[extension]) {
					 var changedKeys = Object.keys(initOpts).filter(function(k){ return compiler[k] != initOpts[k]}) ;
					 if (changedKeys.length) {
						 initOpts.log("File extension "+extension+" already configured for async/await compilation.") ;
					 }
				 }
				 require.extensions[extension] = compileNodentedFile(compiler,initOpts.log) ;
			}
		}
	}

	// Finally, load any required covers
	if (initOpts.use) {
		if (Array.isArray(initOpts.use)) {
			initOpts.log("Warning: nodent({use:[...]}) is deprecated. Use nodent.require(module,options)\n"+(new Error().stack).split("\n")[2]);
			if (initOpts.use.length) {
				initOpts.use.forEach(function(x){
					compiler[x] = compiler.require(x) ;
				}) ;
			}
		} else {
			initOpts.log("Warning: nodent({use:{...}}) is deprecated. Use nodent.require(module,options)\n"+(new Error().stack).split("\n")[2]);
			Object.keys(initOpts.use).forEach(function(x){
				compiler[x] = compiler.require(x,initOpts.use[x])
			}) ;
		}
	}
	return compiler ;
} ;

/* Export these so that we have the opportunity to set the options for the default .js parser */
initialize.setDefaultCompileOptions = function(compiler,env) {
	if (compiler) {
		Object.keys(compiler).forEach(function(k){
			if (!(k in defaultCodeGenOpts))
				throw new Error("NoDent: unknown compiler option: "+k) ;
			defaultCodeGenOpts[k] = compiler[k] ;
		}) ;
	}

	env && Object.keys(env).forEach(function(k){
		if (!(k in env))
			throw new Error("NoDent: unknown configuration option: "+k) ;
		config[k] = env[k] ;
	}) ;
	return initialize ;
};

initialize.setCompileOptions = function(set,compiler) {
	optionSet[set] = optionSet[set] || copyObj([defaultCodeGenOpts]);
	compiler && Object.keys(compiler).forEach(function(k){
		if (!(k in defaultCodeGenOpts))
			throw new Error("NoDent: unknown compiler option: "+k) ;
		optionSet[set][k] = compiler[k] ;
	}) ;
	return initialize ;
};

initialize.asyncify = asyncify ;
initialize.Thenable = Thenable ;

module.exports = initialize ;

/* If invoked as the top level module, read the next arg and load it */
if (require.main===module && process.argv.length>=3) {
	function readStream(stream) {
		return new Thenable(function ($return, $error) {
			var buffer = [] ;
			stream.on('data',function(data){
				buffer.push(data)
			}) ;
			stream.on('end',function(){
				var code = buffer.map(function(b){ return b.toString()}).join("") ;
	            return $return(code);
			}) ;
			stream.on('error',$error) ;
	    }.$asyncbind(this));
	}

	function getCLIOpts(start) {
		var o = [] ;
		for (var i=start || 2; i<process.argv.length; i++) {
			if (process.argv[i].slice(0,2)==='--') {
				var opt = process.argv[i].slice(2).split('=') ;
				o[opt[0]] = opt[1] || true ;
			}
			else
				o.push(process.argv[i]) ;
		}
		return o ;
	}

	var path = require('path') ;
	var initOpts = (process.env.NODENT_OPTS && JSON.parse(process.env.NODENT_OPTS)) || {};
	var filename, cli = getCLIOpts() ;
	initialize.setDefaultCompileOptions({
		sourcemap:cli.sourcemap,
		wrapAwait:cli.wrapAwait
	});

	var nodent = initialize({
		augmentObject:true
	}) ;

	if (!cli.fromast && !cli.parseast && !cli.pretty && !cli.out && !cli.ast && !cli.minast && !cli.exec) {
		// No input/output options - just require the
		// specified module now we've initialized nodent
		try {
			var mod = path.resolve(cli[0]) ;
			return require(mod);
		} catch (ex) {
			ex.message = cli[0]+": "+ex.message ;
			throw ex ;
		}
	}

	if (cli.length==0 || cli[0]==='-') {
		filename = "(stdin)" ;
		return readStream(process.stdin).then(processInput,globalErrorHandler) ;
	} else {
		filename = path.resolve(cli[0]) ;
		var content = stripBOM(fs.readFileSync(filename, 'utf8'));
		return processInput(content) ;
	}

	function processInput(content){
		var pr ;
		var parseOpts ;

		// Input options
		cli.use = cli.use ? '"use nodent-'+cli.use+'";' : '"use nodent";' ;
		if (cli.fromast) {
			content = JSON.parse(content) ;
			pr = { origCode:"", filename:filename, ast: content } ;
			parseOpts = parseCompilerOptions(content,nodent.log) ;
			if (!parseOpts) {
				parseOpts = parseCompilerOptions(cli.use,nodent.log) ;
				console.warn("/* "+filename+": No 'use nodent*' directive, assumed "+cli.use+" */") ;
			}
		} else {
			parseOpts = parseCompilerOptions(content,nodent.log) ;
			if (!parseOpts) {
				parseOpts = parseCompilerOptions(cli.use,nodent.log) ;
				console.warn("/* "+filename+": No 'use nodent*' directive, assumed "+cli.use+" */") ;
			}
			pr = nodent.parse(content,filename,parseOpts);
		}

		// Processing options
		if (!cli.parseast && !cli.pretty)
			nodent.asynchronize(pr,undefined,parseOpts,nodent.log) ;

		// Output options
		nodent.prettyPrint(pr,parseOpts) ;
		if (cli.out || cli.pretty) {
			console.log(pr.code) ;
		}
		if (cli.minast || cli.parseast) {
			console.log(JSON.stringify(pr.ast,function(key,value){
				return key[0]==="$" || key.match(/^(start|end|loc)$/)?undefined:value
			},2,null)) ;
		}
		if (cli.ast) {
			console.log(JSON.stringify(pr.ast,function(key,value){ return key[0]==="$"?undefined:value},0)) ;
		}
		if (cli.exec) {
			(new Function(pr.code))() ;
		}
	}
}
