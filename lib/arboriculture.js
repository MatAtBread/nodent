/* We maniulate (abstract syntax) trees */

var parser = require('./parser') ;
var outputCode = require('./output') ;
		

/** Helpers **/
parser._acorn.Node.prototype.valueOf = function() {
	return printNode(this) ;
}

function printNode(n) {
	if (Array.isArray(n)) return n.map(printNode).join("|\n") ;
	try {
		return outputCode(n) ;
	} catch (ex) {
		return ex.message+"\n"+n.type ;
	}
}

function cloneNode(n) {
	if (Array.isArray(n))
		return n.map(function(n){return cloneNode(n)}) ;
	var o = {} ;
	Object.keys(n).forEach(function(k){ o[k] = n[k] }) ;
	return o ;
}

/* Bit of a hack: without having to search for references to this
 * node, force it to be some replacement node */
function coerce(node,replace) {
	node.__proto__ = Object.getPrototypeOf(replace) ;
	Object.keys(node).forEach(function(k){ delete node[k]}) ;
	Object.keys(replace).forEach(function(k){ node[k] = replace[k]}) ;
}

function examine(node) {
	if (!node) 
		return {} ;

	return {
		isScope:node.type==='FunctionDeclaration' || node.type==='FunctionExpression' || node.type==='Function' || node.type==='Program',
		isFunction:node.type==='FunctionDeclaration' || node.type==='FunctionExpression' || node.type==='Function' || node.type==='ArrowFunctionExpression',
		isClass:node.type==='ClassDeclaration' || node.type==='ClassExpression',
		isBlockStatement:(node.type==='Program' || node.type==='BlockStatement')?node.body:(node.type==='SwitchCase'?node.consequent:false),
		isExpressionStatement:node.type==='ExpressionStatement',
		isLiteral:node.type==='Literal',
		isUnaryExpression:node.type==='UnaryExpression',
		isAwait:node.type==='UnaryExpression' && node.operator==='await',
		isAsync:(node.type==='UnaryExpression' && node.operator==='async') || (node.async),
		isStatement:node.type==='VariableDeclaration' || node.type.match(/[a-zA-Z]+Statement/)!==null,
		isExpression:node.type.match(/[a-zA-Z]+Expression/)!==null,
		isLoop:node.type==='ForStatement' || node.type==='WhileStatement' || node.type==='DoWhileStatement', // Other loops?
		isJump:node.type==='ReturnStatement' || node.type==='ThrowStatement' || node.type==='BreakStatement' || node.type==='ContinueStatement'
	};
}

function containsAwait(ast) {
	if (!ast)
		return null ;

	var n,foundAwait = {} ;

	if (Array.isArray(ast)) {
		for (var i=0;i<ast.length;i++)
			if (n = containsAwait(ast[i]))
				return n ;
		return null ;
	}

	try {
		parser.treeWalker(ast,function(node, descend, path){
			if (examine(node).isUnaryExpression && node.operator=="await") {
				foundAwait.node = node ;
				throw foundAwait ;
			}
			if (node===ast || !examine(node).isFunction)
				descend() ;
		});
	} catch (ex) {
		if (ex===foundAwait)
			return foundAwait.node ;
		throw ex ;
	}
	return null ;
}

function containsAsyncExit(ast) {
	if (!ast)
		return null ;
	
	var foundExit = {} ;
	try {
		parser.treeWalker(ast,function(node, descend, path){
			if (node.type==='ReturnStatement' || node.type==='ThrowStatement') {
				if (examine(node.argument).isAsync) {
					for (var i=1; i<path.length; i++)
						if (path[i].self!==ast && examine(path[i].self).isFunction) {
							foundExit.node = node ;
							throw foundExit ;
						}
				}
			}
			descend() ;
		});
	} catch (ex) {
		if (ex===foundExit)
			return foundExit.node ;
		throw ex ;
	}
	return null ;
}


function containsBlockScopedDeclarations(nodes) {
	for (var i=0; i<nodes.length; i++) {
		var node = nodes[i] ;
		if (node.type==='ClassDefinition' ||
			(node.type==='VariableDeclaration' && (node.kind==='let'||node.kind==='const'))) {
			return true ;
		}
	}
	return false ;
}

function setCatch(n,sym) {
	n.$catcher = sym ;
	return n ;
}

function asynchronize(pr,__sourceMapping,opts,logger) {
	var continuations = {} ;
	var generatedSymbol = 1 ;

	var assign$Args = {
		"type": "VariableDeclaration",
	    "kind": "var",
		"declarations": [{
	    	 "type": "VariableDeclarator",
	    	 "id": { "type": "Identifier", "name": opts.$arguments },
	    	 "init": { "type": "Identifier", "name": "arguments" }
	     }]
	} ;

	function replaceArguments(ast) {
		if (!ast)
			return false ;

		var r = false;

		if (Array.isArray(ast)) {
			for (var i=0;i<ast.length;i++)
				if (n = replaceArguments(ast[i]))
					r = true ;
			return r ;
		}

		parser.treeWalker(ast,function(node, descend, path){
			if (node.type==='Identifier' && node.name==='arguments') {
				node.name = opts.$arguments ;
				r = true ;
			} else if (node===ast || !examine(node).isFunction)
				descend() ;
		});
		return r ;
	}
	
	function where(node) {
		return pr.filename+(node&&node.loc&&node.loc.start?"("+node.loc.start.line+":"+node.loc.start.column+")\t":"\t") ;
	}
	
	function generateSymbol(node) {
		return (node?(node.name||(node.id?node.id.name:"_")||"_").replace(/[^a-zA-Z0-9_\.\$\[\]].*/g,"").replace(/[\.\[\]]/g,"_"):"")+"$"+generatedSymbol++ ;
	}
	
	function getCatch(path,parent) {
		for (var n=0;n<path.length;n++) {
			if (path[n].self.$catcher) {
				return {type:'Identifier',name:path[n].self.$catcher} ;
			}
			if (path[n].parent && path[n].parent.$catcher) {
				return {type:'Identifier',name:path[n].parent.$catcher} ;
			}
		}
		return parent || {type:'Identifier',name:opts.$error} ;
	}

	pr.ast = fixSuperReferences(pr.ast) ;
	if (opts.generators) {
		pr.ast = asyncSpawn(pr.ast) ;
	} else {
		// Because we create functions (and scopes), we need all declarations before use
		pr.ast = hoistScopedDeclarations(pr.ast) ;
		pr.ast = hoistDeclarations(pr.ast) ;

		// All TryCatch blocks need a name so we can (if necessary) find out what the enclosing catch routine is called
		pr.ast = labelTryCatch(pr.ast) ;

		// Convert async functions and their contained returns & throws
		pr.ast = asyncDefine(pr.ast) ;
		pr.ast = asyncDefineMethod(pr.ast) ;
		
		// Loops are asynchronized in an odd way - the loop is turned into a function that is
		// invoked through tail recursion OR callback. They are like the inner functions of
		// async functions to allow for completion and throwing
		pr.ast = asyncLoops(pr.ast) ;

		// Handle the various JS control flow keywords by splitting into continuations that could
		// be invoked asynchronously
		pr.ast = walkDown(pr.ast,[mapTryCatch,mapIfStmt,mapSwitch]) ;

		// Map awaits by creating continuations and passing them into the async resolver
		pr.ast = asyncAwait(pr.ast) ;

		// Remove guff generated by transpiling
		pr.ast = cleanCode(pr.ast) ;
	}
	return pr ;

	function makeBoundFn(name,body,argnames) {
		// :> var name = function(args}{body}.$asyncbind(this)
		return {
			type:'VariableDeclaration',
			kind:'var',
			declarations:[{
				type:'VariableDeclarator',
				id:{type:'Identifier',name:name},
				init:{
		            "type": "CallExpression",
		            "callee": {
		              "type": "MemberExpression",
		              "object": {
		                "type": "FunctionExpression",
		                "id": null,
		                "generator": false,
		                "expression": false,
		                "params": argnames||[],
		                "body": {
		                  "type": "BlockStatement",
		                  "body": cloneNode(body)
		                }
		              },
		              "property": {
		                "type": "Identifier",
		                "name": "$asyncbind"
		              },
		              "computed": false
		            },
		            "arguments": [{"type": "ThisExpression"}]
		          }
			}]
		};
	}

	/* Create a 'continuation' - a block of statements that have been hoisted
	 * into a named function so they can be invoked conditionally or asynchronously */
	function makeContinuation(name,body) {
		var ctn = {
			$continuation: true,
			type:'FunctionDeclaration',
			id:{type:'Identifier',name:name},
			params:[],
			body:{type:'BlockStatement',body:cloneNode(body)}
		} ;

		continuations[name] = {def:ctn} ;
		return ctn ;
	}

	/* Used to invoke a 'continuation' - a function that represents
	 * a block of statements lifted out so they can be labelled (as
	 * a function definition) to be invoked via multiple execution
	 * paths - either conditional or asynchronous. Since 'this' existed
	 * in the original scope of the statements, the continuation function
	 * must also have the correct 'this'.*/
	function thisCall(name,args){
		if (typeof name==='string')
			name = {type:'Identifier',name:name} ;

		var n = {
			"type": "CallExpression",
			"callee": {
				"type": "MemberExpression",
				"object": name,
				"property": {
					"type": "Identifier",
					"name": "call"
				},
				"computed": false
			},
			"arguments": [{"type": "ThisExpression"}].concat(args||[])
		};
	
		name.$thisCall = n ;
		n.$thisCallName = name.name ;
		return n ;
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
	function mapReturns(n,path,containers){
		if (Array.isArray(n)) {
			return n.map(function(m){return mapReturns(m,path,containers)}) ;
		}
		var lambdaNesting = 0 ;
		return parser.treeWalker(n,function(node,descend,path) {
			var repl,value ;
			if (node.type==='ReturnStatement' && !node.$mapped) {
				if (lambdaNesting > 0) {
					if (examine(node.argument).isAsync) {
						value = [cloneNode(node.argument.argument)] ;
						repl = node ; //cloneNode(node) ; //repl = new AST_Return({value:undefined}) ;
					}
				} else {
					if (!containers) {
						repl = node ; //cloneNode(node) ;
						value = repl.argument?[cloneNode(repl.argument)]:[] ;
					}
				}
				if (!value) {
					descend(node);
					return ;
				} else {
					/* NB: There is a special case where we do a REAL return to allow for chained async-calls and synchronous returns
					 *
					 * The selected syntax for this is:
					 * 	return void (expr) ;
					 * which is mapped to:
					 * 	return (expr) ;
					 *
					 * Note that the parenthesis are necessary in the case of anything except a single symbol as "void" binds to
					 * values before operator. In the case where we REALLY want to return undefined to the callback, a simple
					 * "return" or "return undefined" works. */
					if (value.length>0 && examine(value[0]).isUnaryExpression && value[0].operator==="void") {
						repl.argument = value[0].argument ;
					} else {
						repl.argument = {
							"type": "CallExpression",
							"callee": {
								"type": "Identifier",
								"name": opts.$return
							},
							"arguments": value
						} ;
					}
					return ;
				}
			} else if (node.type === 'ThrowStatement') {
				if (lambdaNesting>0) {
					if (examine(node.argument).isAsync) {
						value = cloneNode(node.argument.argument) ;
					}
				} else {
					if (!containers) {
						value = cloneNode(node.argument) ;
					}
				}

				if (!value) {
					descend(node);
					return ;
				} else {
					repl = {
					    type:'ReturnStatement',
					    argument:{
					    	type:'CallExpression',
					    	callee:getCatch(path),
					    	arguments:[value]
					    }
					} ;
					repl.$mapped = true ;
					coerce(node,repl) ;
					return ;
				}
			} else if (examine(node).isFunction) {
				lambdaNesting++ ;
				descend(node);
				lambdaNesting-- ;
				return ;
			}  else {
				descend(node);
				return ;
			}
		},path);
	}

	/**
	 * ES7 await keyword - transform an AST like:
myfn("start") ;
myfn(await test(1)) ;
myfn("ok") ;

	 * to:
myfn("start") ;
return test(1)(function(_var){
myfn(_var) ;
myfn("ok") ;
});
	 */

	/*
	 * Translate:
	if (x) { y; } more... ;
	 * into
	if (x) { y; return $more(); } function $more() { more... } $more() ;
	 *
	 * ...in case 'y' uses await, in which case we need to invoke $more() at the end of the
	 * callback to continue execution after the case.
	 */
	function mapIfStmt(ifStmt, path, down){
		if (ifStmt.type==='IfStatement' && containsAwait([ifStmt.consequent,ifStmt.alternate])) {
			var symName = "$post_if_"+generateSymbol(ifStmt.test) ;
			var synthBlock = {type:'BlockStatement',body:[ifStmt]} ;

			var ref = path[0] ;
			if ('index' in ref) {
				var idx = ref.index ;
				var deferredCode = ref.parent[ref.field].splice(idx+1,ref.parent[ref.field].length-(idx+1)) ;
				ref.parent[ref.field][idx] = synthBlock ;
				if (deferredCode.length) {
					var call = {type:'ReturnStatement',argument:thisCall(symName)} ;
					synthBlock.body.unshift(down(makeContinuation(symName,deferredCode))) ;
					
					[ifStmt.consequent,ifStmt.alternate].forEach(function(cond) {
						if (!cond)
							return ;
						var blockEnd ;
						if (!examine(cond).isBlockStatement)
							blockEnd = cond ;
						else
							blockEnd = cond.body[cond.body.length-1] ;
						if (!(blockEnd.type==='ReturnStatement')) {
							if (!(cond.type==='BlockStatement')) {
								coerce(cond,{type:'BlockStatement',body:[cloneNode(cond)]}) ;
							}
							cond.$deferred = true ;
							cond.body.push(cloneNode(call)) ;
						}
						down(cond) ;
					}) ;

					// If both blocks are transformed, the trailing call to $post_if()
					// can be omitted as it'll be unreachable via a synchronous path
					if (!(ifStmt.consequent && ifStmt.alternate && ifStmt.consequent.$deferred && ifStmt.alternate.$deferred))
						synthBlock.body.push(cloneNode(call)) ;
				}
			} else {
				ref.parent[ref.field] = synthBlock ;
			}
		}
	}

	function mapSwitch(switchStmt, path, down){
		if (!switchStmt.$switched && switchStmt.type==='SwitchStatement' && containsAwait(switchStmt.cases)){
			switchStmt.$switched = true ;
			var symName,deferred,deferredCode,ref = path[0] ;
			if ('index' in ref) {
				var j = ref.index+1 ;
				deferredCode = ref.parent[ref.field].splice(j,ref.parent[ref.field].length-j) ;
				if (deferredCode.length && deferredCode[deferredCode.length-1].type === 'BreakStatement')
					ref.parent[ref.field].push(deferredCode.pop()) ;
				symName = "$post_switch_"+generateSymbol(switchStmt.expression) ;
				deferred = thisCall(symName) ;
				ref.parent[ref.field].unshift(makeContinuation(symName,deferredCode)) ;
				ref.parent[ref.field].push({type:'ExpressionStatement',expression:cloneNode(deferred)}) ;
			}

			// Now transform each case so that 'break' looks like return <deferred>
			switchStmt.cases.forEach(function(caseStmt,idx){
				if (!(caseStmt.type === 'SwitchCase')) {
					throw new Error("switch contains non-case/default statement: "+caseStmt.type) ;
				}
				if (containsAwait(caseStmt.consequent)) {
					var end = caseStmt.consequent[caseStmt.consequent.length-1] ;
					if (end.type === 'BreakStatement') {
						caseStmt.consequent[caseStmt.consequent.length-1] = {type:'ReturnStatement',argument:deferred && cloneNode(deferred)} ;
					} else if (end.type==='ReturnStatement' || end.type==='ThrowStatement') {
						// Do nothing - block ends in return or throw
					} else {
						logger(where(caseStmt)+"switch-case fall-through not supported - added break") ;
						caseStmt.consequent.push({type:'ReturnStatement',argument:deferred && cloneNode(deferred)}) ;
					}
				}
			}) ;
			return true ;
		}
	}

	function mapTryCatch(node, path, down) {
		if (node.type==='TryStatement' && containsAwait(node) && !node.$mapped) {
			var continuation ;
			var ref = path[0] ;
			if ('index' in ref) {
				var i = ref.index+1 ;
				var afterTry = ref.parent[ref.field].splice(i,ref.parent[ref.field].length-i) ;
				if (afterTry.length) {
					var ctnName = "$post_try_"+generateSymbol() ;
					var afterContinuation = makeContinuation(ctnName,afterTry) ;
					afterContinuation = down(afterContinuation) ;
					ref.parent[ref.field].unshift(afterContinuation) ;
					continuation = thisCall(ctnName) ;
				}
			} else {
				throw new Error(pr.filename+" - malformed try/catch blocks") ;
			}

			node.$mapped = true ;
			if (continuation) {
				node.block.body.push(cloneNode(continuation)) ;
				node.handler.body.body.push(cloneNode(continuation)) ;
			}
			if (node.handler) {
				var symCatch = getCatch(path) ; 
				// catcher is not a continuation as it has arguments
				var catcher = makeBoundFn(symCatch.name,node.handler.body.body,[cloneNode(node.handler.param)]) ;
				node.handler.body.body = [{
					type:'CallExpression',
					callee:symCatch,
					arguments:[cloneNode(node.handler.param)]
				}] ;
				ref.parent[ref.field].unshift(catcher) ;
			}
			if (node.finalizer) { /** TODO: Not yet working! **/
				logger(where(node.finalizer)+"finally {...} not implemented correctly");
			}
		}
	}

	function walkDown(ast,mapper,state){
		var walked = [] ;

		return parser.treeWalker(ast,function(node,descend,path){
			if (walked.indexOf(node)>=0)
				return ;

			function walkDownSubtree(node){
				walked.push(node) ;
				return walkDown(node,mapper,path) ;
			}

			if (Array.isArray(mapper)) {
				var walk = this ;
				mapper.forEach(function(m){
					m(node,path,walkDownSubtree);
				}) ;
			} else {
				mapper(node,path,walkDownSubtree) ;
			}
			descend() ;
			return ;
		},state) ;
	}

	function asyncAwait(ast,inAsync,parentCatcher) {
		parser.treeWalker(ast,function(node, descend, path){
			descend();
			if (examine(node).isAwait) {
				/* Warn if this await expression is not inside an async function, as the return
				 * will depend on the Thenable implementation, and references to $return might
				 * not resolve to anything */
				inAsync = inAsync || path.some(function(ancestor){
					return ancestor.self && ancestor.self.$wasAsync ;
				}) ;

				if (!inAsync || inAsync==="warn") {
					var errMsg = where(node)+"'await' used inside non-async function. " ;
					if (opts.promises)
						errMsg += "'return' value Promise runtime-specific" ;
					else
						errMsg += "'return' value from await is synchronous" ;
					logger(errMsg) ;
				}

				var parent = path[0].parent ;
				if ((parent.type==='LogicalExpression') && (parent.operator=="||" || parent.operator=="&&") && parent.right===node) {
					logger(where(node.argument)+"'"+printNode(parent)+"' on right of "+parent.operator+" will always evaluate '"+printNode(node.argument)+"'") ;
				}
				if ((parent.type==='ConditionalExpression') && parent.test!==node) {
					logger(where(node.argument)+"'"+printNode(parent)+"' will always evaluate '"+printNode(node.argument)+"'") ;
				}

				var result = {type:'Identifier',name:"$await_"+generateSymbol(node.argument)} ;
				var expr = cloneNode(node.argument) ;
				coerce(node,result) ;

				// Find the statement containing this await expression (and it's parent)
				var stmt,body ;
				for (var n=1; n<path.length; n++) {
					if (body = examine(path[n].self).isBlockStatement) {
						stmt = path[n-1] ;
						break ;
					}
				}
				if (!stmt)
					throw new Error(where(node)+"Illegal await not contained in a statement") ;

				var i = stmt.index ;
				var callBack = body.splice(i,body.length-i).slice(1);
				
				// If stmt is only a reference to the result, suppress the result
				// reference as it does nothing
				if (!((stmt.self.type==='Identifier' || stmt.self.name===result.name) || 
						(stmt.self.type==='ExpressionStatement' && 
								stmt.self.expression.type==='Identifier' && 
								stmt.self.expression.name===result.name)))
					callBack.unshift(stmt.self);
				
				// Wrap the callback statement(s) in a Block and transform them
				var cbBody = {type:'BlockStatement',body:cloneNode(callBack)} ;
				var catcher = getCatch(path,parentCatcher) ;
				cbBody = asyncAwait(cbBody,inAsync,catcher) ;

				var returner = {type:'FunctionExpression', params:[],body:{type:'BlockStatement',body:[]}} ;
				if (cbBody.body.length) {
					returner = {
						type:'CallExpression',
						callee:{
							type:'MemberExpression',
							object:{
								type:'FunctionExpression', 
								params:[cloneNode(result)],
								body:{type:'BlockStatement',body:cbBody.body}
							},
							property:{
								type:'Identifier',name:opts.bindAwait
							},
							computed:false
						},
						arguments:[{type:'ThisExpression'},catcher]
					} ;
				}

				// We now always apply .then(), even in es7 mode, to allow
				// for interoperability between implementations at the source level
				/*if (opts.promises)*/ {
					expr = {
						type:'MemberExpression',
						object:cloneNode(expr),
						property:{type:'Identifier',name:'then'},
						computed:false
					} ;
				}

				var call = {type:'CallExpression',callee:expr,arguments:[returner,catcher]} ;

				body.push({type:'ReturnStatement',argument:call }) ;
			}
			return true ;
		}) ;
		return ast ;
	}

	/* Map loops:

	for (init;cond;step) body ;
	 * to:
	init;
	await (async function $for_i_0_i_10_i$1() {
	 if (cond) {
	   body;
	   step;
	   return void $for_i_0_i_10_i$1()($return,$error) ;
	 } else {
	  $return();
	 }
	})() ;

	 * Also:
 	do { body } while (cond) ;
	 * to:
 	await (async function $for_i_0_i_10_i$1() {
	  body;
	  if (cond) {
	   return void $for_i_0_i_10_i$1()($return,$error) ;
	 } else {
	  $return();
	 }
	})() ;
	 */
	function asyncLoops(ast) {
		parser.treeWalker(ast,function(node, descend, path){
			descend() ;
			if (examine(node).isLoop && containsAwait(node)) {
				var ref = path[0] ;

				var init = node.init ;
				var condition = node.test ;
				var step = node.update ;
				var body = node.body ;

				if (init && (!examine(init).isStatement))
					init = {type:'ExpressionStatement',expression:init} ;
				step = step?{type:'ExpressionStatement',expression:step}:null ;
				body = (examine(body).isBlockStatement) ? cloneNode(body).body:[cloneNode(body)] ;

				var symName = "$"+node.type.toLowerCase()+"_"+generateSymbol(condition) ;
				var symExit = "$exit_"+generateSymbol(condition) ;
				var loop = {type:'Identifier',name:symName} ;

				// How to exit the loop
				var mapBreak = {
					type:'ReturnStatement',
					argument:{
						type:'UnaryExpression',
						operator:'void',
						prefix:true,
						argument:{
							type:'CallExpression',
							callee:{type:'Identifier',name:symExit},
							arguments:[]
						}
					}
				} ;

				// How to continue the loop
				var symContinue = "$next_"+generateSymbol() ;
				var defContinue = makeContinuation(symContinue,[{
			    	type:'ReturnStatement',
			    	argument:{
			    		type:'CallExpression',
			    		callee:cloneNode(loop),
			    		arguments:[{
			    			type:'Identifier',
			    			name:symExit
			    		},{
			    			type:'Identifier',
			    			name:opts.$error
			    		}]
			    	}
			    }]) ;

				if (step)
					defContinue.body.body.unshift(step) ;

				var mapContinue = {
					type:'ReturnStatement',
					argument:{
						type:'UnaryExpression',
						operator:'void',
						prefix:true,
						argument:thisCall(symContinue)
					}
				} ;

				for (var i=0; i<body.length;i++) {
					parser.treeWalker(body[i],function(n,descend){
						if (n.type==='BreakStatement') {
							coerce(n,cloneNode(mapBreak)) ;
						} else if (n.type==='ContinueStatement') {
							coerce(n,cloneNode(mapContinue)) ;
						} else if (examine(n).isFunction) {
							return true ;
						}
						descend() ;
					}) ;
				}

				body.push(cloneNode(mapContinue));

				var subCall = {
					type:'FunctionDeclaration',
					id:{type:'Identifier',name:symName/*cloneNode(loop)*/},
					params:[{
						type:'Identifier',
						name:symExit
					},{
						type:'Identifier',
						name:opts.$error
					}],
					body:{type:'BlockStatement',body:[defContinue]}
					
				} ;

				var nextTest ;
				if (node.type==='DoWhileStatement') {
					defContinue.body.body = [{
						type:'IfStatement',
						test:cloneNode(condition),
						consequent:{type:'BlockStatement',body:cloneNode(defContinue.body.body)},
						alternate:{
							type:'ReturnStatement',
							argument:{
								type:'CallExpression',
								callee:{
									type:'Identifier',
									name:symExit
								},
								arguments:[]
							}
						}
					}] ;
					subCall.body.body = [defContinue].concat(body) ;
				} else {
					var nextTest = {
						type:'IfStatement',
						test:cloneNode(condition),
						consequent:{
							type:'BlockStatement',
							body:body
						},
						alternate:cloneNode(mapBreak)
					} ;

					subCall.body.body.push(nextTest) ;
				}

				var replace = {
					type:'ExpressionStatement',
					expression:{
						type:'UnaryExpression',
						operator:'await',
						argument:{
							type:'CallExpression',
							arguments:[{type:'ThisExpression'}],
							callee:{
								type:'MemberExpression',
								object:subCall,
								property:{type:'Identifier',name:opts.bindLoop},
								computed:false
							}
						}
					}
				} ;

				if (init)
					ref.parent[ref.field].splice(ref.index,1,cloneNode(init),replace) ;
				else
					ref.parent[ref.field][ref.index] = replace ;
			}
			return true ;
		});
		return ast ;
	}

	/**
	 * Uglify transormer: Transform
	 *
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

	function asyncDefineMethod(ast) {
		return parser.treeWalker(ast,function(node,descend,path){
			descend();
			if ((node.type==='MethodDefinition' || (node.type==='Property' && node.method)) 
					&& node.async && examine(node.value).isFunction) {
				node.async = false ;
				var usesArgs = replaceArguments(node.value) ;
				var funcback = {
					type:'CallExpression',
					arguments:[{type:'ThisExpression'}],
					callee:{
						type:'MemberExpression',
						object:setCatch({
							type:'FunctionExpression',
							params:[{
								type:'Identifier',
								name:opts.$return
							},{
								type:'Identifier',
								name:opts.$error
							}],
							body:asyncDefineMethod(mapReturns(node.value.body,path)),
							$wasAsync:true
						},opts.$error),
						property:{type:'Identifier',name:opts.bindAsync},
						computed:false
					}
				} ;
				
				if (opts.promises) {
					node.value.body = {type:'BlockStatement',body:[{
						type:'ReturnStatement',
						argument:{
							type:'NewExpression',
							callee:{type:'Identifier',name:'Promise'},
							arguments:[funcback]
						}
					}]} ;
				} else {
					node.value.body = {type:'BlockStatement',body:[{
						type:'ReturnStatement',
						argument:funcback
					}]};
				}
				if (usesArgs) {
					node.value.body.body.unshift(assign$Args);
				}
			}
		});		
	}
	
function asyncDefine(ast) {
		parser.treeWalker(ast,function(node, descend, path){
			if (examine(node).isAsync && examine(node.argument).isFunction) {
				// "async" is unary operator that takes a function as it's operand, e.g.
				// async function <name?>([args]?){ <body> }

				var fn = node.argument ;
				var replace = cloneNode(fn) ;
				var fnBody ;
				var usesArgs = replaceArguments(fn) ;
				if (examine(fn.body).isBlockStatement) {
					fnBody = {
						type:'BlockStatement',
						body:fn.body.body.map(function(sub){
							return asyncDefine(mapReturns(sub,path)) ;
						})
					} ;
				} else {
					fnBody = {
						type:'BlockStatement',
						body:[asyncDefine(mapReturns({type:'ReturnStatement',argument:fn.body},path))]
					} ;
					replace.expression = false ;
				}

				var funcback = {
					type:'CallExpression',
					arguments:[{type:'ThisExpression'}],
					callee:{
						type:'MemberExpression',
						object:setCatch({
							type:'FunctionExpression',
							params:[{
								type:'Identifier',
								name:opts.$return
							},{
								type:'Identifier',
								name:opts.$error
							}],
							body:fnBody,
							$wasAsync:true
						},opts.$error),
						property:{type:'Identifier',name:opts.bindAsync},
						computed:false
					}
				} ;
				
				if (opts.promises) {
					replace.body = {type:'BlockStatement',body:[{
						type:'ReturnStatement',
						argument:{
							type:'NewExpression',
							callee:{type:'Identifier',name:'Promise'},
							arguments:[funcback]
						}
					}]} ;
				} else {
					replace.body = {type:'BlockStatement',body:[{
						type:'ReturnStatement',
						argument:funcback
					}]};
				}
				if (usesArgs) {
					replace.body.body.unshift(assign$Args);
				}

				var parent = path[0].parent ;
				if (examine(parent).isExpressionStatement) {
					replace.type = 'FunctionDeclaration' ;
					coerce(parent,replace) ;
				} else {
					coerce(node,replace) ;
				}
				return ;
			} 
			descend() ;
		});
		return ast ;
	}

	/*
	 * Rewrite
			async function <name>?<argumentlist><body>
		to
			function <name>?<argumentlist>{ return function*() {<body>}.$asyncspawn(); }
	 */
	// Like mapReturns, but ONLY for return/throw async
	function mapAsyncReturns(ast) {
		if (Array.isArray(ast)) {
			return ast.map(mapAsyncReturns) ;
		}
		var lambdaNesting = 0 ;
		return parser.treeWalker(ast,function(node,descend,path) {
			if ((node.type === 'ThrowStatement' || node.type==='ReturnStatement') && !node.$mapped) {
				if (lambdaNesting > 0) {
					if (examine(node.argument).isAsync) {
						node.argument = {
							"type": "CallExpression",
							"callee": {
								"type": "Identifier",
								"name": (node.type === 'ThrowStatement')?opts.$error:opts.$return
							},
							"arguments": [node.argument.argument]
						};
						node.type = 'ReturnStatement' ;
						return ;
					}
				}
			} else if (examine(node).isFunction) {
				lambdaNesting++ ;
				descend(node);
				lambdaNesting-- ;
				return ;
			}
			descend(node);
		});
	}
	
	function spawnBody(body) {
		return {
	      "type": "BlockStatement",
	      "body": [{
	          "type": "ReturnStatement",
	          "argument": {
	            "type": "CallExpression",
	            "callee": {
	              "type": "MemberExpression",
	              "object": {
	                "type": "FunctionExpression",
	                "id": null,
	                "generator": true,
	                "expression": false,
	                "params": [{type:'Identifier',name:'$return'},{type:'Identifier',name:'$error'}],
	                "body": {
	                	type:'BlockStatement',
	                	body:mapAsyncReturns(body).concat({
		                	type:'ReturnStatement',
		                	argument:{type:'Identifier',name:'$return'}
	                	})
	                 }
	              },
	              "property": {
	                "type": "Identifier",
	                "name": "$asyncspawn"
	              },
	              "computed": false
	            },
	            "arguments": [{type:'Identifier',name:'Promise'},{type:'ThisExpression'}]
	          }
	        }]
	    };
	}
	function asyncSpawn(ast) {
		function warnAsyncExit(exit,fn) {
			if (!fn.$asyncexitwarninig) {
				fn.$asyncexitwarninig = true ;
				logger(where(exit)+"'"
						+{ReturnStatement:'return',ThrowStatement:'throw'}[exit.type]
						+" async' not possible with 'use nodent-generator'. Using Promises for function at "+where(fn)) ;
			}
		}
		
		function mapAwaits(ast) {
			parser.treeWalker(ast,function(node, descend, path){
				if (node!==ast && examine(node).isFunction) 
					return ;
				if (examine(node).isAwait) {
					delete node.operator ;
					node.delegate = false ;
					node.type = 'YieldExpression';
					descend() ;
				} else descend() ;
			}) ;
		}

		function promiseTransform(ast) {
			var promises = opts.promises ;
			opts.promises = true ;

			hoistScopedDeclarations(ast) ;
			hoistDeclarations(ast) ;
			labelTryCatch(ast) ;
			asyncDefine(ast) ;
			asyncDefineMethod(ast) ;
			asyncLoops(ast) ;
			walkDown(ast,[mapTryCatch,mapIfStmt,mapSwitch]) ;
			asyncAwait(ast,"warn") ;
			cleanCode(ast) ;

			opts.promises = promises ;
		}

		function expandArrows(fn) {
			if (fn.body.type !== 'BlockStatement') {
				fn.body = {
					type:'BlockStatement',
					body:[{
						type:'ReturnStatement',
						argument:fn.body
					}]
				}
			}
			return fn ;
		}

		parser.treeWalker(ast,function(node, descend, path){
			descend() ;
			var fn,exit ;
			if (examine(node).isAsync && examine(node.argument).isFunction) {
				if (exit = containsAsyncExit(node.argument)) {
					// Do the Promise transform
					warnAsyncExit(exit,node.argument) ;
					promiseTransform(node) ;
				} else {
					fn = node.argument ;
					var usesArgs = replaceArguments(fn) ;
					mapAwaits(fn) ;
					fn = expandArrows(fn) ;
					fn.body = spawnBody(fn.body.body)
					if (usesArgs)
						fn.body.body.unshift(assign$Args) ;
					if (path[0].parent.type==='ExpressionStatement') {
						fn.type = 'FunctionDeclaration' ;
						path[1].replace(fn) ;
					} else {
						path[0].replace(fn) ;
					}
				}
			} else if ((node.type==='MethodDefinition' || (node.type==='Property' && node.method))
				&& node.async && examine(node.value).isFunction) {
				if (exit = containsAsyncExit(node.value)) {
					// Do the Promise transform
					warnAsyncExit(exit,node.value) ;
					promiseTransform(node) ;
				} else {
					node.async = false ;
					var usesArgs = replaceArguments(node.value) ;
					mapAwaits(node.value) ;
					node.value = expandArrows(node.value) ;
					node.value.body = spawnBody(node.value.body.body) ;
					if (usesArgs)
						node.value.body.body.unshift(assign$Args) ;
				}
			}
		});

		// Map (and warn) about any out-of-scope awaits that are being
		// mapped using Promises.
		var promises = opts.promises ;
		opts.promises = true ;
		parser.treeWalker(ast,function(node, descend, path){
			descend() ;
			if (examine(node).isFunction && containsAwait(node.body)) {
				hoistScopedDeclarations(node) ;
				hoistDeclarations(node) ;
				labelTryCatch(node) ;
				asyncLoops(node) ;
				walkDown(node,[mapTryCatch,mapIfStmt,mapSwitch]) ;
				asyncAwait(node,"warn") ;
				cleanCode(node) ;
			}
		}) ;
		opts.promises = promises ;
		return ast ;
	}

	/* Find all nodes within this scope matching the specified function */
	// TODO: For ES6, this needs more care, as blocks containing 'let' have a scope of their own
	function scopedNodes(ast,matching) {
		var matches = [] ;
		parser.treeWalker(ast,function(node, descend, path){
			if (node === ast)
				return descend() ;
			
			if (matching(node,path)) {
				matches.push([].concat(path)) ;
				return ;
			}
			if (examine(node).isScope) {
				return ;
			}
			descend() ;
		}) ;
		return matches ;
	}

	function pathIsLoopInitializer(p) {
	    if (p.field=="init" && p.parent.type==='ForStatement') return true ;
	    if (p.field=="left" && (p.parent.type==='ForInStatement' || p.parent.type==='ForOfStatement')) 
	    	return true ;
	    return false ;
	}
	
	/* Move directives, vars and named functions to the top of their scope */
	function hoistDeclarations(ast) {
		parser.treeWalker(ast,function(node, descend,path){
			descend() ;
			if (examine(node).isScope) { 
				// For this scope, find all the hoistable functions, vars and directives
				var functions = scopedNodes(node,function hoistable(n,path) {
					// YES: We're a named async function
					if (examine(n).isAsync 
							&& examine(n.argument).isFunction
							&& n.argument.id)
						return true ;

					// YES: We're a named function, but not a continuation
					if (examine(n).isFunction && n.id) {
						return !n.$continuation ;
					}

					// No, we're not a hoistable function
					return false ;
				}) ;

				// TODO: For ES6, this needs more care, as blocks containing 'let' have a scope of their own
				var vars = scopedNodes(node,function(n,path){
					if (n.type==='VariableDeclaration' && n.kind==='var') {
						return !pathIsLoopInitializer(path[0]) ;
					}
				}) ;
				var directives = scopedNodes(node,function(n){
					/* TODO: directives are not obvious in ESTREE format */ 
					return (n.type==='ExpressionStatement' && n.expression.type==='Literal') ;
				}) ;

				var nodeBody = node.type==='Program'?node:node.body ;
				functions = functions.map(function(path) {
					var ref = path[0], symName ;
					// What is the name of this function (could be async, so check the expression if necessary),
					// and should we remove and hoist, or reference and hoist?
					if (examine(ref.self).isAsync) {
						symName = ref.self.argument.id.name ;
						// If we're nested ExpressionStatement(UnaryExpression<async>), we're actually a top-level
						// async FunctionDeclaration, otherwise we're an async FunctionExpression
						if (examine(ref.parent).isExpressionStatement) {
							ref.self.argument.type = 'FunctionDeclaration' ;
							path[1].remove() ; 
							return ref.self ;
						}
						// We're an async FunctionExpression
						return ref.replace({type:'Identifier',name:symName}) ;
					} 

					// We're just a vanilla FunctionDeclaration or FunctionExpression
					symName = ref.self.id.name ;
					var movedFn = (ref.self.type==='FunctionDeclaration')?
							ref.remove():
							ref.replace({type:'Identifier',name:symName}) ;
					return movedFn ;
				}) ;

				var varDecls = [] ;
				if (vars.length) {
					var definitions = [] ;
					vars.forEach(function(path){
						var ref = path[0] ;
						var self = ref.self ;
						var values = [] ;
						for (var i=0; i<self.declarations.length; i++) {
							var name = self.declarations[i].id.name ;
							var idx = definitions.indexOf(name) ; 
							if (idx>=0) {
								logger(where(self.declarations[i])+"Duplicate 'var "+name+"' in '"+(node.name?node.name.name:"anonymous")+"()'") ;
							} else {
								definitions.push(name) ;
							}
							if (self.declarations[i].init) {
								var value = {
									type:'AssignmentExpression',
									left:{type:'Identifier',name:name},
									operator:'=',
									right:cloneNode(self.declarations[i].init)
								} ;

								if (!(ref.parent.type==='ForStatement'))
									value = {type:'ExpressionStatement',expression:value} ;
								values.push(value) ;
							}
						}
						if (values.length==0)
							ref.remove() ;
						else 
							ref.replace(values) ;
					}) ;

					if (definitions.length) {
						definitions = definitions.map(function(name){ 
							return {
								type:'VariableDeclarator',
								id:{
									type:'Identifier',
									name:name
								}
							}
						}) ;
						if (!varDecls[0] || varDecls[0].type !== 'VariableDeclaration') {
							varDecls.unshift({
								type:'VariableDeclaration',
								kind:'var',
								declarations:definitions}) ;
						} else {
							varDecls[0].declarations = varDecls[0].declarations.concat(definitions) ;
						}
					}
				}

				directives = directives.map(function(path){
					var ref = path[0] ;
					return ref.remove() ;
				}) ;

				nodeBody.body = directives.concat(varDecls).concat(functions).concat(nodeBody.body) ;
			}
			return true ;
		}) ;
		return ast ;
	}

	function mapSupers(classNode) {
		function superID() {
			return classNode.$superID = classNode.$superID || {
				type:'Identifier',
				name:"$super$"+(generatedSymbol++),
			} ;
		}
		return function(method) {
				if (method.async){
					parser.treeWalker(method.value.body,function(node,descend,path){
						if (!examine(node).isClass) {
							descend() ;
							if (node.type==='Super') {
								if (path[0].parent.type==='MemberExpression') {
									if (path[1].parent.type==='CallExpression' && path[1].field==='callee') {
										var r ;
										if (path[0].parent.computed) {
											// super[m](...)	maps to:	this.$superid(m).call(this,...)
											r = {
												"type": "CallExpression",
												"callee": {
													"type": "MemberExpression",
													"object": {
														"type": "CallExpression",
														"callee": {
															"type": "MemberExpression",
															"object": { "type": "ThisExpression" },
															"property": superID(),
															"computed": false
														},
														"arguments": [path[0].parent.property]
													},
													"property": {
														"type": "Identifier",
														"name": "call"
													},
													"computed": false
												},
												"arguments": [{"type": "ThisExpression"}].concat(path[1].parent.arguments)
											} ;
											path[2].replace(r) ;
										} else {
											// super.m(...)		maps to:	this.$superid('m').call(this,...)
											r = {
												"type": "CallExpression",
												"callee": {
													"type": "MemberExpression",
													"object": {
														"type": "CallExpression",
														"callee": {
															"type": "MemberExpression",
															"object": { "type": "ThisExpression" },
															"property": superID(),
															"computed": false
														},
														"arguments": [{
										            	  "type": "Literal",
										            	  "value": path[0].parent.property.name,
										            	  "raw": "'"+path[0].parent.property.name+"'"
														}]
													},
													"property": {
														"type": "Identifier",
														"name": "call"
													},
													"computed": false
												},
												"arguments": [{"type": "ThisExpression"}].concat(path[1].parent.arguments)
											} ;	
											path[2].replace(r) ;
										}
									} else {
										if (path[0].parent.computed) {
											// super[f],		maps to:	this.$superid(f)
											r = {
												"type": "CallExpression",
												"callee": {
													"type": "MemberExpression",
													"object": { "type": "ThisExpression" },
													"property": superID(),
													"computed": false
												},
												"arguments": [path[0].parent.property]
											} ;
											path[1].replace(r) ;
										} else {
											// super.f,			maps to:	this.$superid('f')
											r = {
												"type": "CallExpression",
												"callee": {
													"type": "MemberExpression",
													"object": { "type": "ThisExpression" },
													"property": superID(),
													"computed": false
												},
												"arguments": [{
								            	  "type": "Literal",
								            	  "value": path[0].parent.property.name,
								            	  "raw": "'"+path[0].parent.property.name+"'"
												}]
											} ;
											path[1].replace(r) ;
										}
									}
								} else {
									logger(where(node)+"'super' in async methods must be deferenced. async constructor() & invalid, calling 'super()' not supported.") ;
								}
							}
						}
					}) ;
				}
		}
	}
	
	function fixSuperReferences(ast) {
		return parser.treeWalker(ast,function(node,descend,path){
			descend() ;
			if (node.type==='ClassDeclaration' || node.type==='ClassExpression') {
				node.body.body.forEach(mapSupers(node)) ;
				if (node.$superID) {
					node.body.body.push({
						type:'MethodDefinition',
						key:node.$superID,
						kind:'method',
						value: {
							"type": "FunctionExpression",
							"params": [{
								"type": "Identifier",
								"name": "$field"
							}],
							"body": {
								"type": "BlockStatement",
								"body": [{
									"type": "ReturnStatement",
									"argument": {
										"type": "MemberExpression",
										"object": { "type": "Super" },
										"property": {
											"type": "Identifier",
											"name": "$field"
										},
										"computed": true
									}
								}]
							}
						}
					}) ;
				}
			}
		}) ;
	}
	
	/* Move let and classes to the top of their block. We might have a problem with consts, since they
	 * must be initialized at the point on declaration, and the dependent RHS could easily be async */
	function hoistScopedDeclarations(ast) {
		parser.treeWalker(ast,function(node, descend,path){
			descend() ;
			var block;
			if (block = examine(node).isBlockStatement) { 
				// For this block, find all the hoistable classes, lets and consts
				var classes = [] ;
				var lets = [] ;
				parser.treeWalker(node,function(n,descend,path){
					if (n===node)
						return descend();
					if (!examine(n).isBlockStatement)
						descend() ;
					/* Class declarations are scoped like an unnamed 'let':
					 * the are not hoisted and occupy a TDZ until executed.
					 * This declare before use semantic mitigates the need
					 * for hoisting, so we don't do it (until we come across
					 * a case where it's needed!).
					 *
					if (n.type==='ClassDeclaration' || (n.type==='ClassExpression'))
						classes.unshift(path.slice()) ;
					 */
					if (n.type==='VariableDeclaration' && n.kind==='let' && !pathIsLoopInitializer(path[0])) {
						lets.unshift(path.slice()) ;
					}
				},path) ;
				
				classes.forEach(function(path){
					var p = path[0] ;
					if (p.self.type==='ClassDeclaration')
						block.unshift(p.remove()) ;
					else if (p.self.id) {
						var n = p.replace({type:'Identifier',name:p.self.id.name}) ;
						n.type = 'ClassDeclaration' ;
						block.unshift(n) ;
					}
				}) ;
				
				// For each let, replace the initialization (if present) with an assignment,
				// and move the declaration to the top of the block
				var names = [] ;
				lets.forEach(function(path){
					var p = path[0] ;
					for (var i=p.self.declarations.length-1; i>=0; i--) {
						var d = p.self.declarations[i] ;
						names.unshift(d.id) ;
						if (d.init) {
							p.append({
								type:'ExpressionStatement',
								expression:{
									type:'AssignmentExpression',
									operator:'=',
									left:{
										type:'Identifier',
										name:d.id
									},
									right:d.init
								}
							}) ;
						}
					} ;
					p.remove() ;
				});

				if (names.length){
					block.unshift({
						type:'VariableDeclaration',
						kind:'let',
						declarations:names.map(function(id){
							return {type:'VariableDeclarator',id:id}
						})
					}) ;
				}
			}
			return true ;
		}) ;
		return ast ;
	}

	/* Give unique names to TryCatch blocks */
	function labelTryCatch(ast) {
		parser.treeWalker(ast,function(node, descend,path){
			if (node.type==='TryStatement') {
				// Every try-catch needs a name, so asyncDefine/asyncAwait knows who's handling errors
				var parent = getCatch(path).name ;
				setCatch(node,"$catch_"+generateSymbol(node.handler.param)) ;
				node.handler && setCatch(node.handler,parent) ;
				node.finalizer && setCatch(node.finalizer,parent) ;
			}
			descend() ;
		}) ;
		return ast ;
	}

	function replaceSymbols(ast,from,to) {
		parser.treeWalker(ast,function(node,descend,path){
			descend() ;
			if (node.type=='Identifier' && node.name==from) {
				node.name = to ;
			}
		}) ;
		return ast ;
	}

	/* Remove un-necessary nested blocks and crunch down empty function implementations */
	function cleanCode(ast) {
		// Coalese BlockStatements
		
		// TODO: For ES6, this needs more care, as blocks containing 'let' have a scope of their own
		parser.treeWalker(ast,function(node, descend, path){
			descend();
			// If this node is a block with vanilla BlockStatements (no controlling entity), merge them
			var block,child ;
			if ((block = examine(node).isBlockStatement) && !containsBlockScopedDeclarations(block)) {
				// Remove any empty statements from within the block
				for (var i=0; i<block.length; i++) {
					if (child = examine(block[i]).isBlockStatement) {
						[].splice.apply(block,[i,1].concat(child)) ;
					}
				}
			}
		}) ;

		// Truncate BlockStatements with a Jump (break;continue;return;throw) inside
		parser.treeWalker(ast,function(node, descend, path){
			descend();
			if (examine(node).isJump) {
				var ref = path[0] ;
				if ('index' in ref) {
					var i = ref.index+1 ;
					var ctn = ref.parent[ref.field] ;
					while (i<ctn.length) {
						// Remove any statements EXCEPT for function/var definitions
						if ((ctn[i].type==='VariableDeclaration')
							|| ((examine(ctn[i]).isFunction)
								&& ctn[i].id))
							i += 1 ;
						else
							ctn.splice(i,1) ;
					}
				}
			}
		}) ;
		
		/* Inline continuations that are only referenced once */
		
		// Find any continuations that have a single reference
		parser.treeWalker(ast,function(node, descend, path){
			descend();
			if (node.$thisCall && continuations[node.name]) {
				if (continuations[node.name].ref) {
					delete continuations[node.name] ;	// Multiple ref
				} else {
					continuations[node.name].ref = node.$thisCall ;
				}
			}
		}) ;

		var calls = Object.keys(continuations).map(function(c){ return continuations[c].ref }) ;
		if (calls.length) {
			// Replace all the calls to the continuation with the body from the continuation followed by 'return;'
			parser.treeWalker(ast,function(node, descend, path){
				descend();
				if (calls.indexOf(node)>=0) {
					if (path[1].self.type==='ReturnStatement') {
						var sym = node.$thisCallName ;
						var repl = cloneNode(continuations[sym].def.body.body) ;
						continuations[sym].$inlined = true ;
						repl.push({type:'ReturnStatement'}) ;
						path[1].replace(repl) ;
					}
				}
			}) ;

			var defs = Object.keys(continuations).map(function(c){ return continuations[c].$inlined && continuations[c].def }) ;
			// Remove all the (now inline) declarations of the continuations
			parser.treeWalker(ast,function(node, descend, path){
				descend();
				if (defs.indexOf(node)>=0) {
					path[0].remove() ;
				}
			}) ;
		}
/*
		// Find declarations of functions of the form:
		// 		function [sym]() { return _call_.call(this) }
		// or
		// 		function [sym]() { return _call_() }
		// and replace with:
		//		_call_
		// If the [sym] exists and is referenced elsewhere, replace those too. This
		// needs to be done recursively from the bottom of the tree upwards.
		// NB: If _call_ is in the parameter list for the function, this is NOT a correct optimization

		// For either of the call forms above, return the actually invoked symbol name 
		function simpleCallName(node) {
			if ((node.TYPE=="Call")
					&& node.args.length==0
					&& node.expression instanceof U2.AST_SymbolRef) {
				return node.expression.name ;
			}

			if ((node.TYPE=="Call")
					&& node.$thisCallName) {
				return node.$thisCallName ;
			}

			return null ;
		}

		var replaced = {} ;
		asyncWalk = new U2.TreeWalker(function(node, descend){
			descend();

			if (node instanceof U2.AST_Lambda) {
				if ((node.body[0] instanceof U2.AST_Return) && node.body[0].value) {
					var to = simpleCallName(node.body[0].value) ;
					if (to && node.argnames.every(function(sym){ return sym.name != to })) {
						if (replaced[to])
							to = replaced[to] ;
						var from = node.name && node.name.name ;
						if (from) {
					        var stack = asyncWalk.stack;
					        for (var i = stack.length-1; --i >= 0;) {
					            var scope = stack[i];
					            if (scope instanceof U2.AST_Scope) {
									replaced[from] = to ;
									replaceSymbols(scope,from,to) ;
					            }
					        }
							coerce(node,new U2.AST_DeletedNode()) ;
						} else {
							// This is an anonymous function, so can be replaced in-situ
							coerce(node,new U2.AST_SymbolRef({name:to})) ;
						}
					}
				}
			}
			return true ;
		}) ;
		ast.walk(asyncWalk) ;

		// The symbol folding above might generate lines like:
		//		$return.$asyncbind(this,$error)
		// these can be simplified to:
		//		$return
		asyncWalk = new U2.TreeWalker(function(node, descend){
			descend();

			if (node instanceof U2.AST_Call
					&& node.expression instanceof U2.AST_Dot
					&& node.expression.property == "$asyncbind"
					&& node.expression.expression instanceof U2.AST_SymbolRef
					&& node.expression.expression.name == "$return"
			) {
				coerce(node,node.expression.expression) ;
			}
			return true ;
		}) ;
		ast.walk(asyncWalk) ;
*/
		return ast ;
	}
}

module.exports = {
  asynchronize:asynchronize
} ;


