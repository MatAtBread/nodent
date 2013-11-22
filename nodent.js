/**
 * NoDent - Asynchronous JavaScript Language extensions for Node
 * 
 * AST transforms and node loader extension 
 */

var fs = require('fs') ;
var U2 = require("uglify-js");

var config = {
		/* Useful packages */
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
	if (!node.start)
		node.start = new U2.AST_Token({comments_before:[]}) ;
	node.start.comments_before.push(new U2.AST_Token({
		type:"comment2",
		value:value
	})) ;
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
		node = node.clone() ;
		var value = node.value?[node.value.clone()]:[] ;
		node.value = new U2.AST_Call({
			expression:new U2.AST_SymbolRef({name:config.$return}),
			args:value,
		}) ;
		node.value.start = {} ;
		return node ;
	} else if (!tryNesting && (node instanceof U2.AST_Throw)) {
		var value = node.value.clone() ;
		node = new U2.AST_Return({
			value:new U2.AST_Call({
				expression:new U2.AST_SymbolRef({name:config.$error}),
				args:[value],
				start:{}
			})
		}) ;
		return node ;
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
 * This is the principal AST transformer that does two mappings, one to define "async" functions
 * and one to call them using a nice syntax.
 * 
 * The async function definition is:
 * 		function myFunc(args) { 
 * 			body ; 
 * 			return expr ; 
 * 		}
 *
 * is mapped to:
 * 
 * 		function myFunc(args) { 	
 * 			return function($return,$error) {
 * 				try {
 * 					body ;
 * 					$return(expr) ;
 * 				} catch (ex) {
 * 					$error(ex) ;
 * 				}
 * 			}
 * 		}
 * 
 * Remember, we simply transforming a syntactic short-cut into a "normal" JS function. In this case, we're
 * using the "funcback" pattern, where a function returns a function that expects two callback arguments, 
 * one to handle the result, and another to handle exceptions (bear with me - it sounds worse than it is).
 * 
 * This JS pattern looks like the second function above, and is called like this:
 * 		myFunc(args)(function(returnValue){ -- do something -- }, function(exception) { -- do something else }) ;
 * 
 * The reason for using this pattern is to make it easy to chain asynchronous callbacks together - myFunc can 
 * "return" whenever it likes, and can pass the handler functions onto another async function with too much nasty
 * indenting.
 * 
 * However, as the sample above shows, it's still very "noisy" in code terms - lots of anonymous functions and
 * functions retruning functions. AJS introduces two syntactic constructs to make this pattern readable and
 * "natural" for all those procedural, synchronous guys out there.
 * 
 * To declare an asynchronous function, put "async-" in front of the definition. Note "async" is like a modifier,
 * there's no variable or function called "async", the syntax transformer just checks for that lexical token. This
 * is how it looks:
 * 
 *  async-function myFunc(args) {
 *  	if (!args)
 *  		throw new Error("Missing parameters") ;
 *  	return doSomething(args) ;
 *  }
 *  
 *  The ACTUAL function created will be:
 *  	function myFunc(args) {
 *  		return function($return,$error) {
 *  			try {
 *  				if (!args)
 *  					throw new Error("Missing parameters") ;
 *  				return $return(doSomething(args)) ;
 *  			} catch ($except) {
 *  				$error($except) ;
 *  			}
 *  		}.bind(this) ;
 *  	}
 *  
 *  This is just a normal JS function, that you can call like:
 *  
 *  	myFunc(args)(function(success){...}, function(except){...}) ;
 *  
 *  There's no useful "return" as such (although it is reasonable and easy to implement async
 *  cancellation by returning an object that can be invoked to cancel the async operation). The 
 *  result of executing "doSomething" is passed back into "success" in the example above, unless
 *  an exception is thrown, in which case it ends up in the "except" parameter. Note that
 *  although this is designed for asynchronous callbacks, transforming the source doesn't ensure
 *  that. The above example looks pretty synchronous to me, and a few lines like those above
 *  would get pretty messy pretty quickly.
 *  
 *  So, the other transformation is a shorter call sequence. It's meant to look like a special
 *  kind of assignment (because it is).
 *  
 *  	result <<= myFunc(args) ;
 *  	moreStuff(result) ;
 *  
 *  This is transformed into the code:
 *  	
 *  	return myFunc(args)(function(result) {
 *  		moreStuff(result) ;
 *  	},$error) ;
 *  
 *  Yes, it hides a return statement in your code. If you step line by line, you WON'T hit "moreStuff"
 *  immediately after executing "<<=", it will be called later, when myFunc invokes your "success" handler.
 *  
 * 	Note that you don't need to declare the left hand side of "<<=" (i.e. "result" in the example). It's
 *  actually created as a "parameter" to the rest of the code in the block.
 *  
 *  Why "<<="? Not modifying JS syntax means existing editors and checkers shouldn't complain.
 *  Introducing new operators would mean updating the parser and might clash with future JS changes. But won't 
 *  it break existing JS code? Only code that is already potentially broken - the right hand side of - and <<= 
 *  are defined by JS not to be function definitions. If you have functions to the right of - and <<=
 *  your code is already broken (NB: there are some caveats here in that static syntax transformation
 *  can't tell whats on the right isn't really a number, but we check it looks like a call rather than
 *  a variable. In this way you can "repair" any broken code). In any case, the file extension for AJS 
 *  is ".njs", so your shouldn't be running any existing .js files through it in any case. Finally, judicious
 *  use of parenthesis will allow uou to restore the original functionality.  
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
		addComment(replace,"*"+(undefinedReturn?"":assignee.name)+" <<= *") ;
		return replace ;
	} else {
		descend(node, this);
		return node ;
	}
}) ;

var asyncDefine = new U2.TreeTransformer(function(node, descend){
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

function prettyPrint(ast) {
	var str = U2.OutputStream({beautify:true,comments:true,bracketize:true, width:160, space_colon:true}) ;
	ast.print(str);
	return str.toString() ;
}

var nodent = {
		prettyPrint:prettyPrint,
		parse:function(code,filename) { 
			var ast = U2.parse(code.toString(), {strict:false,filename:filename}) ;
			ast.figure_out_scope();
			return ast ;
		},
		asynchronize:function(ast) {
			ast = ast.transform(asyncDefine) ; 
			ast = ast.transform(asyncAssign) ;
			return ast ;
		},
		decorate:function(ast) {
			ast.walk(decorate) ;
			return ast ;
		},
		AST:U2
};

function reportParseException(ex,content,filename) {
	var sample = content.substring(ex.pos-20,ex.pos-1)
			+"^"+content.substring(ex.pos,ex.pos+1)+"^"
			+content.substring(ex.pos+1,ex.pos+21) ;
	sample = sample.replace(/[\r\n\t]+/g,"\t") ;
	console.error(filename+" (line:"+ex.line+",col:"+ex.col+"): "+ex.message+":: "+sample) ;
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
					var ast = nodent.parse(content,filename);
					for (var i=0; i<ast.body.length; i++) {
						if (ast.body[i] instanceof U2.AST_Directive && ast.body[i].value==opts.useDirective) {
							return require.extensions[opts.extension](mod,filename) ;
						}
					}
				} catch (ex) {
					if (ex.constructor.name=="JS_Parse_Error") 
						reportParseException(ex,content,filename) ;
					else
						throw ex;
				}
				return stdJSLoader(mod,filename) ;
			} ;
		}
	
		require.extensions[opts.extension] = function(mod, filename) {
			try {
				var code,content = stripBOM(fs.readFileSync(filename, 'utf8'));
				var ast = nodent.parse(content,filename);
				nodent.asynchronize(ast) ;
				code = nodent.prettyPrint(ast) ;
				// Mangle filename to stop node-inspector overwriting the original source
				mod._compile(code, "nodent:///"+filename);
			} catch (ex) {
				if (ex.constructor.name=="JS_Parse_Error") 
					reportParseException(ex,content,filename) ;
				throw ex ;
			}
		};
	}
	
	opts.use.forEach(function(k){
		if (!nodent[k])
			nodent[k] = require("./covers/"+k)(nodent) ;
	});

	for (var k in opts) {
		if (!config.hasOwnProperty(k))
			throw new Error("NoDent: unknown option: "+k+"="+JSON.stringify(opts[k])) ;
		if (k!="use") 
			config[k] = opts[k] ;
	}
	configured = true ;
	return nodent ;
} ;
