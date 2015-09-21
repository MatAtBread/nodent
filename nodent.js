#!/usr/bin/env node

/**
 * NoDent - Asynchronous JavaScript Language extensions for Node
 *
 * AST transforms and node loader extension
 */

var SourceMapConsumer = require('source-map').SourceMapConsumer;
var fs = require('fs') ;
var outputCode = require('./output') ;//require('astring') ;//require("escodegen").generate ;
//var outputCode = require("escodegen").generate ;//require('astring') ;// ;

var acorn = require("acorn");
var acornParse = acorn.parse ; //require("acorn/dist/acorn_loose").parse_dammit ;//acorn.parse.bind(acorn) ;
var acornWalk = require("acorn/dist/walk");
var acornBase = acornWalk.make({
	SwitchStatement: function (node, st, c) {
		c(node.discriminant, st, "Expression");
		for (var i = 0; i < node.cases.length; ++i) {
			c(node.cases[i],st/*,"SwitchCase"*/) ;
		}
	},
	SwitchCase: function (node, st, c) {
		if (node.test) c(node.test, st, "Expression");
		for (var i = 0; i < node.consequent.length; ++i) {
			c(node.consequent[i], st, "Statement");
		}
	},
	TryStatement: function (node, st, c) {
		c(node.block, st, "Statement");
		if (node.handler) c(node.handler, st, "Statement");
		if (node.finalizer) c(node.finalizer, st, "Statement");
	},
	CatchClause: function (node, st, c) {
		c(node.param, st, "Pattern");
		c(node.body, st, "ScopeBody");
	},
	Class: function (node, st, c) {
	  if (node.id) c(node.id, st, "Pattern");
	  if (node.superClass) c(node.superClass, st, "Expression");
	  c(node.body, st);
	}, 
	ClassBody: function(node, st, c){
	  for (var i = 0; i < node.body.length; i++) {
		  c(node.body[i], st);
	  }
	}
}) ;

acorn.plugins.nodent = function(parser){
	var tokens = {} ;
	["async","await"].forEach(function(kw){
		tokens[kw] = new acorn.TokenType(kw,{beforeExpr: true, prefix: true, startsExpr: true, keyword: kw}) ;
	}) ;

	parser.extend("finishToken",function(base){
		return function(type,val){
			type = type || (tokens.hasOwnProperty(val) && tokens[val]) ;
			return base.call(this,type,val);
		}
	}) ;

	parser.extend("isKeyword",function(base){
		return function(str){
			return tokens.hasOwnProperty(str) || base.apply(this,arguments);
		}
	}) ;

	parser.extend("isReservedWord",function(base){
		return function(str){
			return tokens.hasOwnProperty(str) || base.apply(this,arguments);
		}
	}) ;
	
	parser.extend("parsePropertyName",function(base){
		return function (prop) {
			var key = base.apply(this,arguments) ;
			if (key.type === "Identifier" && key.name === "async") {
				prop.async = true ;
				key = base.apply(this,arguments) ;
			}
			return key;
		};
	}) ;
}

var referencePrototypes = {
	replace: function(newNode) {
		var r = cloneNode(this.self) ;
		if ('index' in this) {
			if (Array.isArray(newNode)) {
				[].splice.apply(this.parent[this.field],[this.index,1].concat(newNode)) ;
			} else {
				this.parent[this.field][this.index] = newNode ;
			}
		} else {
			if (Array.isArray(newNode)) {
				this.parent[this.field] = {type:'BlockStatement',body:newNode} ;
			} else {
				this.parent[this.field] = newNode ;
			}
		}
		return r ;
	},
	index: function(){
		return this.parent[this.field].indexOf(this.self) ;
	},
	removeElement: function() {
		return this.parent[this.field].splice(this.index,1)[0] ;
	},
	removeNode: function() {
		var r = this.parent[this.field] ;
		delete this.parent[this.field] ;
		return r ;
	}
};

function treeWalker(n,walker,state){
	if (!state) {
		state = [{self:n}] ;
		state.replace = function(pos,newNode) {
			state[pos].replace(newNode) ;
		}
		state.parentBlock = function(pos) {
			for (var i=pos || 0; i<state.length; i++) {
				if (examine(state[i].parent).isBlockStatement)
					return state[i] ;
			}
			return null ;
		}
	} 
	
	function descend() {
		acornBase[n.type](n,state,function down(sub,_,derivedFrom){
			if (sub===n)
				return acornBase[derivedFrom || n.type](n,state,down) ;
			
			function goDown(ref) {
				ref.replace = referencePrototypes.replace ;
				if (ref.index) {
					Object.defineProperties(ref, {index:{enumerable:true,get:referencePrototypes.index}}) ;
					ref.remove = referencePrototypes.removeElement ;
				} else {
					ref.remove = referencePrototypes.removeNode ;
				}
				state.unshift(ref) ;
				treeWalker(sub,walker,state) ;
				state.shift() ;
			}
			
			Object.keys(n).forEach(function(k){
				if (Array.isArray(n[k]) && n[k].indexOf(sub)>=0) {
					return goDown({
						self:sub,
						parent:n,
						field:k,
						index:true
					}) ;
				} else if (n[k] instanceof Object && sub===n[k]) {
					return goDown({
						self:sub,
						parent:n,
						field:k
					}) ;
				}
			}) ;
		}) ;
	} ;
	walker(n,descend,state) ;
	return n ;
}

/** Helpers **/
function info(node) {
	if (Array.isArray(node))
		return node.map(info) ;
	return node.type ;
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
	var o = {} ;
	Object.keys(n).forEach(function(k){ o[k] = n[k] }) ;
	return o ;
}
function cloneNodes(nodes) {
	return nodes.map(function(n){return cloneNode(n)}) ;
}

function toArray(ast) {
	if (examine(ast).isBlockStatement)
		ast = ast.body ;
	if (!Array.isArray(ast))
		ast = [ast] ;

	return cloneNodes(ast) ;
}

var config = {
		augmentObject:false,
		sourceMapping:1,	/* 0: Use config value, 1: rename files for Node, 2: rename files for Web, 3: No source map */
		use:[],
		useDirective:/^\s*['"]use\s+nodent['"]\s*;/,
		useES7Directive:/^\s*['"]use\s+nodent\-es7['"]\s*;/,
		usePromisesDirective:/^\s*['"]use\s+nodent\-promises?['"]\s*;/,
		useGeneratorsDirective:/^\s*['"]use\s+nodent\-generators?['"]\s*;/,
		extension:'.njs',
		$return:"$return",
		$error:"$error",
		log:function(msg){ console.warn("Nodent: "+msg) },
		bindAwait:"$asyncbind",
		bindAsync:"$asyncbind",
		bindLoop:"$asyncbind"
//		$except:"$except"
};

/* Extract compiler options from code (either a string or AST) */
function parseCompilerOptions(code,initOpts) {
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
				promises: !!code.match(initOpts.usePromisesDirective),
				es7: !!code.match(initOpts.useES7Directive),
				generators: !!code.match(initOpts.useGeneratorsDirective),
				es5assign: !!code.match(initOpts.useDirective)
		} ;
		if (parseOpts.promises) parseOpts.es7 = true ;
	} else {
		// code is an AST
		for (var i=0; i<pr.ast.body.length; i++) {
			if (examine(code.body[i]).isExpressionStatement
				&& examine(code.body[i].expression).isLiteral) {
				var test = "'"+code.body[i].value+"'" ;
				parseOpts.promises = matches(test,initOpts.usePromisesDirective) ;
				parseOpts.es7 = parseOpts.promises || matches(test,initOpts.useES7Directive) ;
				parseOpts.generators = matches(test,initOpts.useGeneratorsDirective) ;
				parseOpts.es5assign = matches(test,initOpts.useDirective) ;
			}
		}
	}

	if (parseOpts.promises || parseOpts.es7 || parseOpts.es5assign || parseOpts.generators) {
		if ((parseOpts.promises || parseOpts.es7) && (parseOpts.es5assign || parseOpts.generators)) {
			initOpts.log("No valid 'use nodent*' directive, assumed -es7 mode") ;
			parseOpts = {es7:true} ;
		}
		return parseOpts ;
	}
	return null ; // No valid nodent options
}

/* Bit of a hack: without having to search for references to this
 * node, force it to be some replacement node */
function coerce(node,replace) {
	node.__proto__ = Object.getPrototypeOf(replace) ;
	Object.keys(node).forEach(function(k){ delete node[k]}) ;
	Object.keys(replace).forEach(function(k){ node[k] = replace[k]}) ;
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
	return parent || {type:'Identifier',name:config.$error} ;
}

function setCatch(n,sym) {
	n.$catcher = sym ;
	return n ;
}

function containsAwait(ast) {
	if (!ast)
		return false ;
	
	if (Array.isArray(ast)) {
		for (var i=0;i<ast.length;i++)
			if (containsAwait(ast[i]))
				return true ;
		return false ;
	}
	var foundAwait = {} ;
	try {
		treeWalker(ast,function(node, descend, path){
			if (examine(node).isUnaryExpression && node.operator=="await") {
				throw foundAwait ;
			}
			if (!examine(node).isFunction)
				descend() ;
		});
	} catch (ex) {
		if (ex===foundAwait)
			return true ;
		throw ex ;
	}
	return false ;
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

/*Hack: go though and create "padding" mappings between lines
//Without this, whole blocks of code resolve to call & return sequences.
//This has dependency on the implementation of source-map  which is
//not a healthy thing to have.
function createMappingPadding(mapping) {
	var m = mapping._mappings._array;

	function sortMap(a,b){
		if (a.generatedLine < b.generatedLine)
			return -1 ;
		if (a.generatedLine > b.generatedLine)
			return 1 ;
		if (a.generatedColumn < b.generatedColumn)
			return -1 ;
		if (a.generatedColumn > b.generatedColumn)
			return 1 ;
		return (a.name || "").length - (b.name || "").length ;
	}
	m.sort(sortMap) ;

	var i = 0 ;
	while (i<m.length-1) {
		if (!m[i].name) {
			m.splice(i,1) ;
		} else {
			i++ ;
		}
	}

	i = 1 ;
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

	var lastOrigLine = -1 ;
	for (i=0;i<m.length; i++) {
		if (m[i].originalLine != lastOrigLine) {
			m[i].originalColumn = 0 ;
			lastOrigLine = m[i].originalLine ;
		}
	}

	i = 0 ;
	while (i<m.length-1) {
		if (((m[i].originalLine == m[i+1].originalLine) &&
				(m[i].originalColumn == m[i+1].originalColumn)) ||
				((m[i].generatedLine == m[i+1].generatedLine) &&
						(m[i].generatedColumn == m[i+1].generatedColumn))) {
			m.splice(i,1) ;
		} else {
			i++ ;
		}
	}
	m.sort(sortMap) ;

	if (m.length)
		m.push({
			generatedColumn: 0,
			generatedLine: m[m.length-1].generatedLine+1,
			originalColumn: 0,
			originalLine: m[m.length-1].originalLine+1,
			source: m[m.length-1].source
		}) ;
}
*/
function reportParseException(ex,content,filename) {
	var sample = content.substring(ex.pos-30,ex.pos-1)+
		"^"+content.substring(ex.pos,ex.pos+1)+"^"+
		content.substring(ex.pos+1,ex.pos+31) ;
	sample = sample.replace(/[\r\n\t]+/g,"\t") ;
	return ("NoDent JS: "+filename+" (line:"+ex.line+",col:"+ex.col+"): "+ex.message+"\n"+sample) ;
}

function examine(node) {
	if (!node) 
		return {} ;

	return {
		isScope:node.type==='FunctionDeclaration' || node.type==='FunctionExpression' || node.type==='Function' || node.type==='Program',
		isFunction:node.type==='FunctionDeclaration' || node.type==='FunctionExpression' || node.type==='Function' || node.type==='ArrowFunctionExpression',
		isBlockStatement:node.type==='Program' || node.type==='BlockStatement',
		isExpressionStatement:node.type==='ExpressionStatement',
		isLiteral:node.type==='Literal',
		isUnaryExpression:node.type==='UnaryExpression',
		isAwait:node.type==='UnaryExpression' && node.operator==='await',
		isAsync:node.type==='UnaryExpression' && node.operator==='async',
		isStatement:node.type==='VariableDeclaration' || node.type.match(/[a-zA-Z]+Statement/)!==null,
		isExpression:node.type.match(/[a-zA-Z]+Expression/)!==null,
		isLoop:node.type==='ForStatement' || node.type==='WhileStatement' || node.type==='DoWhileStatement', // Other loops?
		isJump:node.type==='ReturnStatement' || node.type==='ThrowStatement' || node.type==='BreakStatement' || node.type==='ContinueStatement'
	};
}

function asynchronize(pr,sourceMapping,opts,initOpts) {
	var continuations = {} ;
	sourceMapping = sourceMapping || config.sourceMapping ;

	var generatedSymbol = 1 ;
	function generateSymbol(node) {
		return (node?(node.name||(node.id?node.id.name:"_")||"_").replace(/[^a-zA-Z0-9_\.\$\[\]].*/g,"").replace(/[\.\[\]]/g,"_"):"")+"$"+generatedSymbol++ ;
	}

	if (opts.generators) {
		pr.ast = asyncSpawn(pr.ast) ;
	} else {
		// Because we create functions (and scopes), we need all declarations before use
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
		                  "body": cloneNodes(body)
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
			body:{type:'BlockStatement',body:cloneNodes(body)}
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
		return treeWalker(n,function(node,descend,path) {
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
								"name": "$return"
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
		if (switchStmt.type==='SwitchStatement' && containsAwait(switchStmt.cases)){
			var ref = path.parentBlock() ;

			var j = ref.index+1 ;
			var deferredCode = ref.parent[ref.field].splice(j,ref.parent[ref.field].length-j) ;
			if (deferredCode[deferredCode.length-1].type === 'BreakStatement')
				ref.parent[ref.field].push(deferredCode.pop()) ;
			var symName = "$post_switch_"+generateSymbol(switchStmt.expression) ;
			var deferred = thisCall(symName) ;
			var synthBlock = {type:'BlockStatement',body:[switchStmt]} ;

			if (deferredCode.length) {
				synthBlock.body.unshift(makeContinuation(symName,deferredCode)) ;
				synthBlock.body.push({type:'ExpressionStatement',expression:cloneNode(deferred)}) ;
			} else {
				deferred = null ;
			}
			ref.parent[ref.field][ref.index] = synthBlock ;
			down(synthBlock.body[0]) ;

			// Now transform each case so that 'break' looks like return <deferred>
			switchStmt.cases.forEach(function(caseStmt,idx){
				if (!(caseStmt.type === 'SwitchCase')) {
					throw new Error("switch contains non-case/default statement: "+caseStmt.type) ;
				}
				if (containsAwait(caseStmt)) {
					var end = caseStmt.consequent[caseStmt.consequent.length-1] ;
					if (end.type === 'BreakStatement') {
						caseStmt.consequent[caseStmt.consequent.length-1] = {type:'ReturnStatement',argument:cloneNode(deferred)} ;
					} else if (end.type==='ReturnStatement' || end.type==='ThrowStatement') {
						// Do nothing - block ends in return or throw
					} else {
						initOpts.log(pr.filename+" - switch-case fall-through not supported - added break") ;
						caseStmt.consequent.push({type:'ReturnStatement',argument:cloneNode(deferred)}) ;
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
				initOpts.log("Warning: try...finally does not implement finally correctly");
			}
		}
	}

	function walkDown(ast,mapper){
		var walked = [] ;
		function walkDownSubtree(node){
			walked.push(node) ;
			return walkDown(node,mapper) ;
		}

		return treeWalker(ast,function(node,descend,path){
			if (walked.indexOf(node)>=0)
				return ;

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
		}) ;
	}

	function asyncAwait(ast,inAsync,parentCatcher) {
		if (!opts.es7) {
			throw new Error("Nodent ES5 Syntax is deprecated - replace with ES7 async and await keywords, or use nodent <=1.2.x") ;
		}

		treeWalker(ast,function(node, descend, path){
			descend();
			if (examine(node).isAwait) {
				/* Warn if this await expression is not inside an async function, as the return
				 * will depend on the Thenable implementation, and references to $return might
				 * not resolve to anything */
				inAsync = inAsync || path.some(function(ancestor){
					return ancestor.self && ancestor.self.$wasAsync ;
				}) ;

				if (!inAsync) {
					var errMsg = pr.filename+" - Warning: 'await' used inside non-async function. " ;
					if (opts.promises)
						errMsg += "'return' value Promise runtime-specific" ;
					else
						errMsg += "'return' value from await is synchronous" ;
					if (node.loc)
						errMsg += " ("+pr.filename+":"+node.loc.start.line+":"+node.loc.start.column+")" ;
					initOpts.log(errMsg) ;
				}

				var parent = path[0].parent ;
				if ((parent.type==='BinaryExpression') && (parent.operator=="||" || parent.operator=="&&") && parent.right===node) {
					initOpts.log(pr.filename+" - Warning: '"+printNode(parent)+"' on right of "+parent.operator+" will always evaluate '"+printNode(node)+"'") ;
				}
				if ((parent.type==='ConditionalExpression') && parent.condition!==node) {
					initOpts.log(pr.filename+" - Warning: '"+printNode(parent)+"' will always evaluate '"+printNode(node)+"'") ;
				}

				var result = {type:'Identifier',name:"$await_"+generateSymbol(node.argument)} ;
				var expr = cloneNode(node.argument) ;
				coerce(node,result) ;

				// Find the statement containing this await expression (and it's parent)
				var stmt ;
				for (var n=1; n<path.length; n++) {
					if (examine(path[n].self).isBlockStatement) {
						stmt = path[n-1] ;
						break ;
					}
				}
				if (!stmt)
					throw new Error("Illegal await not contained in a statement") ;

				var i = stmt.index ;
				var callBack = stmt.parent[stmt.field].splice(i,stmt.parent[stmt.field].length-i).slice(1);
				
				// If stmt is only a reference to the result, suppress the result
				// reference as it does nothing
				if (!((stmt.self.type==='Identifier' || stmt.self.name===result.name) || 
						(stmt.self.type==='ExpressionStatement' && 
								stmt.self.expression.type==='Identifier' && 
								stmt.self.expression.name===result.name)))
					callBack.unshift(stmt.self);
				
				// Wrap the callback statement(s) in a Block and transform them
				var cbBody = {type:'BlockStatement',body:cloneNodes(callBack)} ;
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
								type:'Identifier',name:initOpts.bindAwait
							},
							computed:false
						},
						arguments:[{type:'ThisExpression'},catcher]
					} ;
				}

				if (opts.promises) {
					expr = {
						type:'MemberExpression',
						object:cloneNode(expr),
						property:{type:'Identifier',name:'then'},
						computed:false
					} ;
				}

				var call = {type:'CallExpression',callee:expr,arguments:[returner,catcher]} ;

				stmt.parent[stmt.field].push({type:'ReturnStatement',argument:call }) ;
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
		treeWalker(ast,function(node, descend, path){
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
			    			name:config.$error
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
					treeWalker(body[i],function(n,descend){
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
						name:config.$error
					}],
					body:{type:'BlockStatement',body:[defContinue]}
					
				} ;

				var nextTest ;
				if (node.type==='DoWhileStatement') {
					defContinue.body.body = [{
						type:'IfStatement',
						test:cloneNode(condition),
						consequent:{type:'BlockStatement',body:cloneNodes(defContinue.body.body)},
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
								property:{type:'Identifier',name:initOpts.bindLoop},
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
		return treeWalker(ast,function(node,descend,path){
			descend();
			if (node.type==='MethodDefinition' && node.async && examine(node.value).isFunction) {
				node.async = false ;
				var fn = cloneNode(node.value) ;
				var funcback = {
					type:'CallExpression',
					arguments:[{type:'ThisExpression'}],
					callee:{
						type:'MemberExpression',
						object:setCatch({
							type:'FunctionExpression',
							params:[{
								type:'Identifier',
								name:config.$return
							},{
								type:'Identifier',
								name:config.$error
							}],
							body:asyncDefineMethod(mapReturns(node.value.body,path)),
							$wasAsync:true
						},config.$error),
						property:{type:'Identifier',name:initOpts.bindAsync},
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
			}
		});		
	}
	
	function asyncDefine(ast) {
		treeWalker(ast,function(node, descend, path){
			if (examine(node).isAsync && examine(node.argument).isFunction) {
				// "async" is unary operator that takes a function as it's operand, e.g.
				// async function <name?>([args]?){ <body> }

				var fn = node.argument ;
				var replace = cloneNode(fn) ;
				var fnBody ;
				if (examine(fn.body).isBlockStatement) {
					fnBody = {
						type:'BlockStatement',
						body:fn.body.body.map(function(sub){
							return asyncDefine(mapReturns(sub,path)) ;
						})
					} ;
				} else {
					// TODO: Why not just: fnBody = asyncDefine(mapReturns({type:'ReturnStatement',argument:fn.body},path))?
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
								name:config.$return
							},{
								type:'Identifier',
								name:config.$error
							}],
							body:fnBody,
							$wasAsync:true
						},config.$error),
						property:{type:'Identifier',name:initOpts.bindAsync},
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
		return treeWalker(ast,function(node,descend,path) {
			if ((node.type === 'ThrowStatement' || node.type==='ReturnStatement') && !node.$mapped) {
				if (lambdaNesting > 0) {
					if (examine(node.argument).isAsync) {
						node.argument = {
							"type": "CallExpression",
							"callee": {
								"type": "Identifier",
								"name": (node.type === 'ThrowStatement')?"$error":"$return"
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
		treeWalker(ast,function(node, descend, path){
			descend() ;
			var fn ;
			if (examine(node).isAwait) {
				// Check we're in an async function
				for (var i=0; i<path.length; i++) {
					if (examine(path[i].self).isFunction && !examine(path[i].parent).isAsync)
						throw new SyntaxError("'await' used inside non-async function ("
								+pr.filename+":"+node.loc.start.line+":"+node.loc.start.column+")") ;
				}
				// TODO: For precedence reasons, this should probably be parenthesized
				delete node.operator ;
				node.delegate = false ;
				node.type = 'YieldExpression';
			} else if (examine(node).isAsync && examine(node.argument).isFunction) {
				fn = node.argument ;
				fn.body = spawnBody(fn.body.body)
				if (path[0].parent.type==='ExpressionStatement') {
					fn.type = 'FunctionDeclaration' ;
					path[1].replace(fn) ;
				} else {
					path[0].replace(fn) ;
				}
			} else if (node.type==='MethodDefinition' && node.async && examine(node.value).isFunction) {
				node.async = false ;
				node.value.body = spawnBody(node.value.body.body) ; 
			}
		});
		return ast ;
	}

	/* Find all nodes within this scope matching the specified function */
	// TODO: For ES6, this needs more care, as blocks containing 'let' have a scope of their own
	function scopedNodes(ast,matching) {
		var matches = [] ;
		treeWalker(ast,function(node, descend, path){
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

	/* Move directives, vars and named functions to the top of their scope */
	function hoistDeclarations(ast) {
		treeWalker(ast,function(node, descend,path){
			descend() ;
			if (examine(node).isScope) { 
				// For this scope, find all the hoistable functions, vars and directives
				var classes = scopedNodes(node,function hoistable(n,path) {
					if (n.type==='ClassDeclaration') 
						return true ;
					return false ;
				}) ;

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
					    if (path[0].field=="init" && path[0].parent.type==='ForStatement') return false ;
					    if (path[0].field=="left" && path[0].parent.type==='ForInStatement') return false ;
					    if (path[0].field=="left" && path[0].parent.type==='ForOfStatement') return false ;
					    return true ;
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


				classes = classes.map(function(path){
					var ref = path[0] ;
					return ref.remove() ;
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
							if (definitions.indexOf(name)>=0) {
								initOpts.log(pr.filename+" - Duplicate 'var "+name+"' in '"+(node.name?node.name.name:"anonymous")+"()'") ;
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

				nodeBody.body = directives.concat(classes).concat(functions).concat(varDecls).concat(nodeBody.body) ;
			}
			return true ;
		}) ;
		return ast ;
	}

	/* Give unique names to TryCatch blocks */
	function labelTryCatch(ast) {
		treeWalker(ast,function(node, descend,path){
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
		treeWalker(ast,function(node,descend,path){
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
		treeWalker(ast,function(node, descend, path){
			descend();
			// If this node is a block with vanilla BlockStatements (no controlling entity), merge them
			if (examine(node).isBlockStatement) {
				// Remove any empty statements from within the block
				for (var i=0; i<node.body.length; i++) {
					if (examine(node.body[i]).isBlockStatement) {
						[].splice.apply(node.body,[i,1].concat(node.body[i].body)) ;
					}
				}
			}
		}) ;

		// Truncate BlockStatements with a Jump (break;continue;return;throw) inside
		treeWalker(ast,function(node, descend, path){
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
		treeWalker(ast,function(node, descend, path){
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
			treeWalker(ast,function(node, descend, path){
				descend();
				if (calls.indexOf(node)>=0) {
					if (path[1].self.type==='ReturnStatement') {
						var sym = node.$thisCallName ;
						var repl = cloneNodes(continuations[sym].def.body.body) ;
						continuations[sym].$inlined = true ;
						repl.push({type:'ReturnStatement'}) ;
						path[1].replace(repl) ;
					}
				}
			}) ;

			var defs = Object.keys(continuations).map(function(c){ return continuations[c].$inlined && continuations[c].def }) ;
			// Remove all the (now inline) declarations of the continuations
			treeWalker(ast,function(node, descend, path){
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

var nodent ;
function asyncify(promiseProvider) {
	promiseProvider = promiseProvider || nodent.Thenable ;
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

function initialize(initOpts){
	if (!initOpts)
		initOpts = config ;

	if (!initialize.configured) {
		// Fill in default config values
		for (var k in config) {
			if (!initOpts.hasOwnProperty(k))
				initOpts[k] = config[k] ;
		}

		var smCache = {} ;
		nodent = {} ;

		nodent.compile = function(code,origFilename,sourceMapping,opts) {
			opts = opts || {} ;
			if (opts.promises)
				opts.es7 = true ;
			sourceMapping = sourceMapping || config.sourceMapping ;

			var pr = nodent.parse(code,origFilename,sourceMapping,opts);
			nodent.asynchronize(pr,sourceMapping,opts,initOpts) ;
			nodent.prettyPrint(pr,sourceMapping,opts) ;
			return pr ;
		};
		nodent.parse = function(code,origFilename,sourceMapping,opts) {
			sourceMapping = sourceMapping || config.sourceMapping ;
			var r = { origCode:code.toString(), filename:origFilename } ;
			try {
				r.ast = acornParse(r.origCode,{
					plugins:{nodent:true},
					ecmaVersion:6, // TODO: Set from option/config
					allowHashBang:true,
					allowReturnOutsideFunction:true,
					locations:true
				}) ;
				return r ;
			} catch (ex) {
				if (ex instanceof SyntaxError) {
					var l = r.origCode.substr(ex.pos-ex.loc.column) ;
					l = l.split("\n")[0] ;
					ex.message = ex.message+" (nodent)\n"+l+"\n"+l.replace(/[\S ]/g,"-").substring(0,ex.loc.column)+"^" ;
					ex.stack = "" ;
				}
				throw ex ;
			}
		};
		nodent.asynchronize = asynchronize ;
		nodent.prettyPrint = function(pr,sourceMapping,opts) {
			sourceMapping = sourceMapping || config.sourceMapping ;

			var map ;
			var filepath = pr.filename.split("/") ; 
			var filename = filepath.pop() ;

			var out = outputCode(pr.ast/*,{map:{
				file: filename, 
				sourceMapRoot: filepath.join("/"),
				sourceContent: pr.origCode
			}}*/) ;

			try {
				var mapUrl = "" ;
				var jsmap = out.map.toJSON();
//				console.log(JSON.stringify(jsmap));
				if (jsmap) {
					smCache[pr.filename] = {map:jsmap,smc:new SourceMapConsumer(jsmap)} ;
					mapUrl = "\n"
						+"\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,"+btoa(JSON.stringify(jsmap))
						+"\n" ;
				}
				pr.code = out.code+mapUrl ;
			} catch (ex) {
				pr.code = out ;
			}

		};
		nodent.decorate = function(pr) {
			pr.ast.walk(decorate) ;
		};
		nodent.require = function(cover,opts) {
			if (!nodent[cover]) {
				if (!opts)
					opts = initOpts.use[cover] ;

				if (cover.indexOf("/")>=0)
					nodent[cover] = require(cover)(nodent,opts) ;
				else
					nodent[cover] = require("./covers/"+cover)(nodent,opts) ;
			}
			return nodent[cover] ;
		};
		nodent.generateRequestHandler = function(path, matchRegex, options) {
			var cache = {} ;

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
								pr = require('./htmlScriptParser')(nodent,content.toString(),req.url,options) ;
								contentType = "text/html" ;
							} else {
								pr = nodent.compile(content.toString(),req.url,2,options.compiler).code;
								contentType = "application/javascript" ;
								if (options.runtime)
									pr = "Function.prototype.$asyncbind = "+nodent.$asyncbind.toString()+";\n"+pr ;
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

		nodent.$asyncbind = function $asyncbind(self,catcher) {
			var resolver = this ;
			if (catcher) {
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
				var b = function() { 
					return resolver.apply(self,arguments) ;
				} ;
				b.then = b ;
				return b ;
			}
		};

		/* Give a funcback a thenable interface, so it can be assimilated by a Promise */
		nodent.Thenable = function(thenable) {
			thenable.then = thenable ;
			return thenable ;
		};
		nodent.isThenable = function(obj) {
			return (obj instanceof Object) && ('then' in obj) && typeof obj.then==="function";
		};
		Object.defineProperty(nodent,"Promise",{
			get:function(){
				initOpts.log("Warning: nodent.Promise is deprecated in favour of nodent.Thenable");
				return nodent.Thenable;
			}
		}) ;

		nodent.spawnGenerator = function(promiseProvider,self) {
			var genF = this ;
		    return new promiseProvider(function(resolve, reject) {
		        var gen = genF.call(self, resolve, reject);
		        function step(fn,arg) {
		            var next;
		            try {
		                next = fn.call(gen,arg);
			            if(next.done) {
			            	if (next.value !== resolve) {
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

		Object.defineProperties(Function.prototype,{
			"$asyncbind":{
				value:nodent.$asyncbind,
				writeable:true,
				configurable:true
			},
			"$asyncspawn":{
				value:nodent.spawnGenerator,
				writeable:true,
				configurable:true
			}
		}) ;

		nodent.asyncify = asyncify ;
		nodent.version = require("./package.json").version ;
		if (initOpts.augmentObject) {
			Object.defineProperties(Object.prototype,{
				"asyncify":{
					value:function(promiseProvider,filter,suffix){return nodent.asyncify(promiseProvider)(this,filter,suffix)},
					writeable:true,
					configurable:true
				},
				"isThenable":{
					value:nodent.isThenable,
					writeable:true,
					configurable:true
				}
			}) ;
		}
		
		/**
		 * We need a global to handle funcbacks for which no error handler has ever been defined.
		 */
		global[config.$error] = function(err) {
			throw err ;
		};

		if (!initOpts.dontMapStackTraces) {
			// This function is part of the V8 stack trace API, for more info see:
			// http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
			Error.prepareStackTrace = function(error, stack) {
				function mappedTrace(frame) {
					var source = frame.getFileName();
					if (source && smCache[source]) {
						var position = smCache[source].smc.originalPositionFor({line: frame.getLineNumber(), column: frame.getColumnNumber()-1});
						var desc = frame.toString() ;

						var s = source.split("/"), d = smCache[source].map.sources[0].split("/") ;
						for (var i=0; i<s.length-1 && s[i]==d[i]; i++) ;
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
		 * @params
		 * idx			The argument index that is the 'callback'. 'undefined' for the final parameter
		 * errorIdx		The argument index of the callback that holds the error. 'undefined' for no error value
		 * resultIdx 	The argument index of the callback that holds the result. 'undefined' for the argument after the errorIdx (errorIdx != undefined)
		 * promiseProvider	For promises, set this to the module providing Promises.
		 */
		Object.defineProperty(Function.prototype,"noDentify",{
			value:function(idx,errorIdx,resultIdx,promiseProvider) {
				promiseProvider = promiseProvider || nodent.Thenable ;
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
			},
			configurable:true,
			enumerable:false,
			writable:true
		}) ;

		var stdJSLoader = require.extensions['.js'] ;
		if (initOpts.useDirective || initOpts.useES7Directive || initOpts.usePromisesDirective) {
			require.extensions['.js'] = function(mod,filename) {
				var content = stripBOM(fs.readFileSync(filename, 'utf8'));
				var parseOpts = parseCompilerOptions(content,initOpts) ;
				if (parseOpts)
					return require.extensions[initOpts.extension](mod,filename,parseOpts) ;
				return stdJSLoader(mod,filename) ;
			} ;
		}

		require.extensions[initOpts.extension] = function(mod, filename, parseOpts) {
			var content = stripBOM(fs.readFileSync(filename, 'utf8'));
			var pr = nodent.parse(content,filename,parseOpts);
			parseOpts = parseOpts || parseCompilerOptions(pr.ast,initOpts) ;
			nodent.asynchronize(pr,undefined,parseOpts,initOpts) ;
			nodent.prettyPrint(pr,undefined,parseOpts) ;
			mod._compile(pr.code, pr.filename);
		};
	}

	if (Array.isArray(initOpts.use))
		initOpts.use.forEach(function(x){nodent.require(x)}) ;
	else {
		Object.keys(initOpts.use).forEach(function(x){nodent.require(x)}) ;
	}

	for (var k in initOpts) {
		if (!config.hasOwnProperty(k))
			throw new Error("NoDent: unknown option: "+k+"="+JSON.stringify(initOpts[k])) ;
		if (k!="use")
			config[k] = initOpts[k] ;
	}
	initialize.configured = true ;
	return nodent ;
} ;

initialize.asyncify = asyncify ;
module.exports = initialize ;

/* If invoked as the top level module, read the next arg and load it */
if (require.main===module && process.argv.length>=3) {
	// Initialise nodent
	var initOpts = (process.env.NODENT_OPTS && JSON.parse(process.env.NODENT_OPTS)) ;
	initialize(initOpts) ;
	var path = require('path') ;
	var n = 2 ;
	if (process.argv[n]=="--out" || process.argv[n]=="--ast") {
		// Compile & output, but don't require
		n += 1 ;
		var filename = path.resolve(process.argv[n]) ;
		var content = stripBOM(fs.readFileSync(filename, 'utf8'));
		var parseOpts = parseCompilerOptions(content,config) ;
		if (!parseOpts) {
			parseOpts = {es7:true} ;
			console.warn("/* "+filename+": No 'use nodent*' directive, assumed -es7 mode */") ;
		}

		var pr = nodent.parse(content,filename,parseOpts);
		nodent.asynchronize(pr,undefined,parseOpts,config) ;
		if (process.argv[n-1]=="--out") {
			nodent.prettyPrint(pr,undefined,parseOpts) ;
			console.log(pr.code) ;
		} else {
			console.log(JSON.stringify(pr.ast,function(key,value){ return key[0]==="$"?undefined:value},0)) ;
		}
	} else {
		// Compile & require
		var mod = path.resolve(process.argv[n]) ;
		require(mod);
	}
}
