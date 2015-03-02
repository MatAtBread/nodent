#!/usr/bin/env node

/**
 * NoDent - Asynchronous JavaScript Language extensions for Node
 * 
 * AST transforms and node loader extension 
 */

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
	AST_Node.warn = function(){} ;
}
var U2 = require("./ug2loader").load(U2patch) ;

var SourceMapConsumer = require('source-map').SourceMapConsumer;
var fs = require('fs') ;

/** Helpers **/
function pretty(node) {
	if (Array.isArray(node))
		return node.map(pretty) ;
	var str = U2.OutputStream({beautify:true,comments:true,bracketize:true, width:160, space_colon:true}) ;
	node.print(str);
	return str.toString() ;
}
function info(node) {
	if (Array.isArray(node))
		return node.forEach(info) ;
	var s = "" ;
	for (var q = node.__proto__; q.TYPE; q=q.__proto__)
		s += q.TYPE+"." ;
	return s+":"+node.print_to_string() ;
}
function cloneNodes(nodes) {
	return nodes.map(function(n){return n.clone()}) ;
}

function toArray(ast) {
	if (ast instanceof U2.AST_BlockStatement)
		ast = ast.body ;
	if (!Array.isArray(ast))
		ast = [ast] ;

	return cloneNodes(ast) ;
}

var config = {
		sourceMapping:1,	/* 0: Use config value, 1: rename files for Node, 2: rename files for Web, 3: No source map */
		use:[],
		useDirective:/['"]use\s+nodent['"]/,
		useES7Directive:/['"]use\s+nodent\-es7['"]/,
		usePromisesDirective:/['"]use\s+nodent\-promise['"]/,
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
	node.$ = "------------".substring(0,decorate.stack.length)+"\t"+node.TYPE+"\t"+node.print_to_string() ;
	console.log(node.$) ;
});

/* Bit of a hack: without having to search for references to this
 * node, force it to be some replacement node */
function coerce(node,replace) {
	node.__proto__ = Object.getPrototypeOf(replace) ;
	Object.keys(node).forEach(function(k){ delete node[k]}) ;
	Object.keys(replace).forEach(function(k){ node[k] = replace[k]}) ;
}

function getCatch(w,nesting) {
	nesting = nesting || 0 ;
	for (var n=w.stack.length-1;n>0;n--)
		if (w.stack[n].catcher) {
			if (!nesting)
				return new U2.AST_SymbolRef({name:w.stack[n].catcher}) ;
			nesting -= 1 ;
		}
	return new U2.AST_SymbolRef({name:config.$error}) ; ;
}

function setCatch(n,sym) {
	if (Array.isArray(n)) {
		n.forEach(function(e){ setCatch(e,sym)}) ;
		return ;
	}
	n.catcher = sym ;
	var clone = n.clone.bind(n) ;
	n.clone = function() {
		var x = clone() ;
		x.catcher = sym ;
		x.clone = n.clone ;
		return x ;
	}
}

function containsAwait(ast) {
	if (Array.isArray(ast)) {
		for (var i=0;i<ast.length;i++)
			if (containsAwait(ast[i]))
				return true ;
		return false ;
	}
	var foundAwait = {} ;
	try {
		var asyncWalk = new U2.TreeWalker(function(node, descend){
			if (node instanceof U2.AST_UnaryPrefix && node.operator=="await") {
				throw foundAwait ;
			}
		});
		ast.walk(asyncWalk) ;
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
	var lastOrigLine = -1 ;
	for (i=0;i<m.length; i++) {
		if (m[i].originalLine != lastOrigLine) {
			m[i].originalColumn = 0 ;
			lastOrigLine = m[i].originalLine ; 
		}
	}

	var i = 0 ;
	while (i<m.length-1) {
		if (((m[i].originalLine == m[i+1].originalLine)
				&& (m[i].originalColumn == m[i+1].originalColumn))
				|| ((m[i].generatedLine == m[i+1].generatedLine)
						&& (m[i].generatedColumn == m[i+1].generatedColumn))) {
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

function reportParseException(ex,content,filename) {
	var sample = content.substring(ex.pos-30,ex.pos-1)
	+"^"+content.substring(ex.pos,ex.pos+1)+"^"
	+content.substring(ex.pos+1,ex.pos+31) ;
	sample = sample.replace(/[\r\n\t]+/g,"\t") ;
	return ("NoDent JS: "+filename+" (line:"+ex.line+",col:"+ex.col+"): "+ex.message+"\n"+sample) ;
} 

function asynchronize(pr,sourceMapping,opts) {
	var continuations = {} ;
	sourceMapping = sourceMapping || config.sourceMapping ; 

	if (sourceMapping==2)
		pr.filename = pr.filename.replace(/\.nodent$/,"") ;
	if (sourceMapping==1)
		pr.filename += ".nodent" ;

	var generatedSymbol = 1 ;
	function generateSymbol(node) {
		return (node?node.print_to_string().replace(/[^a-zA-Z0-9_\.\$\[\]].*/g,"").replace(/[\.\[\]]/g,"_"):"")+"$"+generatedSymbol++ ;	
	}

	pr.ast = asyncLoops(pr.ast) ;
	pr.ast = asyncTryCatch(pr.ast) ;
	pr.ast = asyncDefine(pr.ast) ;
	pr.ast = asyncAwait(pr.ast) ;
	pr.ast = cleanCode(pr.ast) ;
	return pr ;

	function makeFn(name,body,argnames) {
		return new U2.AST_Defun({
			name:new U2.AST_SymbolDefun({name:name}),
			argnames:argnames||[],
			body:cloneNodes(body)}) ;
	}

	function bindThis(expr) {
		if (typeof expr==='string') 
			expr = new U2.AST_SymbolRef({name:expr}) ;

		if (opts.promises)
			return expr ;

		return new U2.AST_Call({
			expression:new U2.AST_Dot({
				expression: expr,
				property: "bind"
			}),
			args:[new U2.AST_This()]
		}) ;
	}

	/* Create a 'continuation' - a block of statements that have been hoisted 
	 * into a named function so they can be invoked conditionally or asynchronously */
	function makeContinuation(name,body) {
		var ctn = new U2.AST_Defun({
			name:new U2.AST_SymbolDefun({name:name}),
			argnames:[],
			body:cloneNodes(body)}) ;
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
			name = new U2.AST_SymbolRef({name:name}) ;

		var n = new U2.AST_Call({
			expression:new U2.AST_Dot({expression:name,property:"call"}),
			args:[new U2.AST_This()].concat(args||[])
		}) ;
		name.thisCall = n ;
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
	function mapReturns(n){
		if (Array.isArray(n)) {
			return n.map(mapReturns) ;
		}
		var lambdaNesting = 0 ;
		var returnMapper = new U2.TreeTransformer(function(node,descend) {
			if (!lambdaNesting && (node instanceof U2.AST_Return) && !node.mapped) {
				var repl = node.clone() ;
				var value = repl.value?[repl.value.clone()]:[] ;
				/*
				 * NB: There is a special case where we do a REAL return to allow
				 * for chained async-calls and synchronous returns
				 * 
				 * The selected syntax for this is:
				 * 
				 * 	return void (expr) ;
				 * 
				 * which is mapped to:
				 * 
				 * 	return (expr) ;
				 * 
				 * Note that the parenthesis are necessary in the case of anything except a single symbol as "void" binds to
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
			} else if (node instanceof U2.AST_Throw) {
				var value = node.value.clone() ;
				var repl = new U2.AST_Return({
					value:new U2.AST_Call({
						expression:getCatch(returnMapper),
						args:[value]
					})
				}) ;
				repl.start = repl.value.start = node.start ;
				repl.end = repl.value.end = node.end ;
				repl.mapped = true ;
				return repl ; 
			} else if (node instanceof U2.AST_Lambda) {
				lambdaNesting++ ;
				descend(node, this);
				lambdaNesting-- ;
				return node ;
			}  else {
				descend(node, this);
				return node ;
			}
		});
		return n.transform(returnMapper) ;
	}

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

	/*
	 * Translate:
	if (x) { y; } more... ;
	 * into
	if (x) { y; return $more(); } function $more() { more... } $more() ;
	 *
	 * ...in case 'y' uses await, in which case we need to invoke $more() at the end of the
	 * callback to continue execution after the case.
	 */

	function ifTransformer(ast){
		var asyncWalk ;
		ast.walk(asyncWalk = new U2.TreeWalker(function(ifStmt, descend){
			if ((ifStmt instanceof U2.AST_If) && 
					(containsAwait(ifStmt.body) || (ifStmt.alternative && containsAwait(ifStmt.alternative)))) {
				descend();
				var parent = asyncWalk.parent(0) ;
				if (!Array.isArray(parent.body)) {
					parent.body = new U2.AST_BlockStatement({body:[parent.body]}) ;
					parent = parent.body ;
				} 
				var j = parent.body.indexOf(ifStmt)+1 ;
				var deferredCode = parent.body.splice(j,parent.body.length-j) ;  

				var symName = "$post_if_"+generateSymbol(ifStmt.condition) ;
				var synthBlock = new U2.AST_BlockStatement({body:[ifStmt.clone()]}) ; 
				coerce(ifStmt, synthBlock) ;
				ifStmt = synthBlock.body[0] ;

				if (deferredCode.length) {
					var call = new U2.AST_Return({value:thisCall(symName)}) ;
					synthBlock.body.push(ifTransformer(makeContinuation(symName,deferredCode))) ;
					synthBlock.body.push(call.clone()) ;

					function transformConditional(cond) {
						var blockEnd ;
						if (!(cond instanceof U2.AST_BlockStatement))
							blockEnd = cond ;
						else
							blockEnd = cond.body[cond.body.length-1] ; 
						if (!(blockEnd instanceof U2.AST_Return)) {
							if (!(cond instanceof U2.AST_BlockStatement)) {
								coerce(cond,new U2.AST_BlockStatement({body:[cond.clone()]})) ;
							}
							cond.body.push(call.clone()) ;
						}
						ifTransformer(cond) ;
					}

					transformConditional(ifStmt.body) ;
					if (ifStmt.alternative) {
						transformConditional(ifStmt.alternative) ;
					}
				}
				return true ;
			}
		})) ;
		return ast ;
	}

	/*
	 * Translate:
	switch () { case:...; break; } more... ;
	 * into
	switch () { case:...; return $more(); } function $more() { more... } $more() ;
	 *
	 * ...in case one of the cases uses await, in which case we need to invoke $more() at the end of the
	 * callback to continue execution after the case.
	 */
	function switchTransformer(ast){
		var asyncWalk ;
		ast.walk(asyncWalk = new U2.TreeWalker(function(switchStmt, descend){
			if ((switchStmt instanceof U2.AST_Switch) && containsAwait(switchStmt.body)){
				if (switchStmt.deferred) {
					throw new Error("Duplicate switch dissection") ;
				}
				var parent = asyncWalk.parent(0) ;
				if (!Array.isArray(parent.body)) {
					parent.body = new U2.AST_BlockStatement({body:[parent.body]}) ;
					parent = parent.body ;
				} 
				var j = parent.body.indexOf(switchStmt)+1 ;
				var deferredCode = parent.body.splice(j,parent.body.length-j) ;  
				if (deferredCode[deferredCode.length-1] instanceof U2.AST_Break)
					parent.body.push(deferredCode.pop()) ;
				var symName = "$post_switch_"+generateSymbol(switchStmt.expression) ;
				var deferred = thisCall(symName) ; 
				var synthBlock = new U2.AST_BlockStatement({body:[switchStmt.clone()]}) ; 

				if (deferredCode.length) {
					synthBlock.body.push(makeContinuation(symName,deferredCode)) ;
					synthBlock.body.push(new U2.AST_SimpleStatement({body:deferred.clone()})) ;
				} else {
					deferred = null ;
				}

				coerce(switchStmt, synthBlock) ;
				switchStmt.body[0].deferred = deferred ;
				switchStmt.body[0].body.forEach(switchTransformer) ;
				return true ;
			}
		})) ;
		return ast ;
	}

	/* try...catch...
	 * 
	 * Needs to transform:

   stmt1 ;
   try { body } catch (ex) { except } 
   stmt2 ;

	 * to

	stm1;
	(function($chain){
		function $error(ex) {
		 	var $error = $chain ;
			except 
		} 
		try { 
			(function(){
		    	body ;
		    })() ;
	    } catch (ex) {
	        $error(ex) ;
	    }
	})($error) 
	stm2;
	 */

	function asyncTryCatch(ast) {
		var asyncWalk = new U2.TreeWalker(function(node, descend){
			descend() ;

			if ((node instanceof U2.AST_Try) && containsAwait(node)) {
				var continuation ;
				var parent = asyncWalk.parent() ;
				if (Array.isArray(parent.body)) {
					var i = parent.body.indexOf(node) ;
					var afterTry = parent.body.splice(i+1,parent.body.length-(i-1)) ;
					if (afterTry.length) {
						var ctnName = "$post_try_"+generateSymbol() ;
						parent.body.push(makeContinuation(ctnName,mapReturns(afterTry))) ;
						continuation = thisCall(ctnName) ; 
					}
				}

				node.body = toArray(mapReturns(node.body)) ;
				if (continuation) {
					node.body.push(continuation.clone()) ;
					node.bcatch.body.push(continuation.clone()) ;
				}
				if (node.bcatch) {
					var sym = "$catch_"+generateSymbol(node.bcatch.argname) ;
					// catcher is not a continuation as it has arguments
					var catcher = makeFn(sym,mapReturns(node.bcatch.body),[node.bcatch.argname.clone()]) ; 
					node.bcatch.body = [catcher,thisCall(sym,[node.bcatch.argname.clone()])] ;
				}
				setCatch(node.body,sym) ;
			}
			return true ;
		});
		ast.walk(asyncWalk) ;
		return ast ;
	}

	function asyncAwait(ast) {
		if (!opts.es7) {
			// Only load deprecated ES5 behaviour if the app uses it.
			var asyncAssignTransfom = require('./es5plus')(U2,config) ;
			return ast.transform(asyncAssignTransfom) ;
		}

		ast = ifTransformer(ast) ;
		ast = switchTransformer(ast) ;
		var asyncWalk = new U2.TreeWalker(function(node, descend){
			descend();
			if (node instanceof U2.AST_UnaryPrefix && node.operator=="await") {
				var result = new U2.AST_SymbolRef({name:"$await_"+generateSymbol(node.expression)}) ;
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
					if (asyncWalk.stack[n] instanceof U2.AST_SwitchBranch) {
						var switchStmt = asyncWalk.stack[n-1] ;
						terminate = function terminateSwitchBranch(call) {
							block.body.push(new U2.AST_Return({ value:call })) ;
						} ;
						var caseBody = asyncWalk.stack[n].body ;
						// TODO: Enforce 'break' as final statement
						var endBody = caseBody.pop() ;
						if (!(endBody instanceof U2.AST_Break)) {
							var start = caseBody.start || {file:'?',line:'?'} ;
							console.warn("Nodent JS: Warning - switch-case missing break"+start.file+":"+start.line) ;
							caseBody.push(endBody) ; // Put it back!
						}
						// Call the post-switch code
						if (switchStmt.deferred) {
							caseBody.push(switchStmt.deferred.clone()) ;
						}
						block = new U2.AST_BlockStatement({body:caseBody}) ;
						asyncWalk.stack[n].body = [block] ;
						break ;
					}
					if (asyncWalk.stack[n] instanceof U2.AST_Block) {
						terminate = function terminateBlock(call) {
							block.body.push(new U2.AST_Return({ value:call })) ;
						} ;
						block = asyncWalk.stack[n] ;
						if (block!==stmt)
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
				var cbBody = new U2.AST_BlockStatement({body:cloneNodes(callBack)}) ;
				cbBody.walk(asyncWalk) ;

				var returner = new U2.AST_Function({argnames:[],body:[]}) ;
				if (cbBody.body.length) {
					returner = new U2.AST_Function({
						argnames:[result.clone()],
						body:cbBody.body
					}) ;
					returner = new U2.AST_Call({
						expression:new U2.AST_Dot({
							expression: returner,
							property: "$asyncbind"
						}),
						args:[new U2.AST_This(),getCatch(asyncWalk)]
					}) ;
				}

				if (opts.promises) {
					expr = new U2.AST_Dot({
						expression:expr.clone(),
						property:"then"
					}) ;
				}

				var call = new U2.AST_Call({
					expression:expr,
					args:[returner,getCatch(asyncWalk)]
				}) ;

				terminate(call) ;
			}
			return true ; 
		}) ;
		ast.walk(asyncWalk) ;
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
		var asyncWalk = new U2.TreeWalker(function(node, descend){
			descend() ;
			function transformLoop() {
				if (!containsAwait(node))
					return ;
				var init = node.init ;
				var condition = node.condition ;
				var step = node.step ;
				var body = node.body ;

				if (init && (!init instanceof U2.AST_Statement))
					init = new U2.AST_SimpleStatement({body:init}) ;
				step = step?new U2.AST_SimpleStatement({body:step}):null ;
				body = (body instanceof U2.AST_BlockStatement) ? body.clone().body:[body.clone()] ;

				var symName = "$"+node.TYPE.toLowerCase()+"_"+generateSymbol(condition) ;
				var loop = new U2.AST_SymbolRef({name:symName}) ;

				// How to exit the loop
				var mapBreak = new U2.AST_Return({
					value:new U2.AST_UnaryPrefix({
						operator:"void",
						expression:new U2.AST_Call({
							args:[],
							expression:new U2.AST_SymbolRef({name:config.$return})
						})})}) ; 

				// How to continue the loop
				var symContinue = "$next_"+generateSymbol() ;
				var defContinue = makeContinuation(symContinue,[new U2.AST_Return({value:
					new U2.AST_Call({
						args:[new U2.AST_SymbolRef({name:config.$return}),
						      new U2.AST_SymbolRef({name:config.$error})],
						      expression:
						    	  opts.promises 
						    	  ?new U2.AST_Dot({expression:new U2.AST_Call({args:[],expression:loop.clone()}),property:"then"})
					:new U2.AST_Call({args:[],expression:loop.clone()})
					})
				})]) ; 

				if (step)
					defContinue.body.unshift(step) ;

				var mapContinue = new U2.AST_Return({
					value:new U2.AST_UnaryPrefix({
						operator:"void",
						expression:thisCall(symContinue)
					})}) ; 

				for (var i=0; i<body.length;i++) {
					var w ;
					body[i].walk(w = new U2.TreeWalker(function(n,descend){
						if (n instanceof U2.AST_Break) {
							coerce(n,mapBreak.clone()) ;
						} else if (n instanceof U2.AST_Continue) {
							coerce(n,mapContinue.clone()) ;
						} else if (n instanceof U2.AST_Lambda) {
							return true ;
						} 
					})) ;
				}

				body.push(mapContinue.clone());

				var subCall = new U2.AST_UnaryPrefix({
					operator:'async',
					expression: new U2.AST_Defun({
						name:loop.clone(),
						argnames:[],
						body:[defContinue]
					})
				});
				subCall.needs_parens = function(){ return true };

				var nextTest ;
				if (node instanceof U2.AST_Do) {
					defContinue.body = [new U2.AST_If({condition:condition.clone(),
						body:new U2.AST_BlockStatement({body:defContinue.body}),
						alternative:new U2.AST_Return({value:new U2.AST_Call({
							expression:new U2.AST_SymbolRef({name:config.$return}),
							args:[]
						})})
					})] ;
					subCall.expression.body = [defContinue].concat(body) ;
				} else {
					var nextTest = new U2.AST_If({condition:condition.clone(),
						body:new U2.AST_BlockStatement({body:body}),
						alternative:mapBreak.clone()
					}) ;
					subCall.expression.body.push(nextTest) ;
				}

				var replace = new U2.AST_SimpleStatement({body:
					new U2.AST_UnaryPrefix({operator:'await',expression:
						new U2.AST_Call({
							args:[],
							expression:subCall,
						})
					})
				});

				var parent = asyncWalk.parent() ;
				if (Array.isArray(parent.body)) {
					var i = parent.body.indexOf(node) ;
					if (init)
						parent.body.splice(i,1,init.clone(),replace) ;
					else
						parent.body[i] = replace ;
				} else {
					if (init)
						parent.body = new U2.AST_BlockStatement({body:[init.clone(),replace]}) ;
					else
						parent.body = replace ;
				}
			}
			if (node instanceof U2.AST_For)
				transformLoop() ;
			else if (node instanceof U2.AST_While)
				transformLoop() ;
			else if (node instanceof U2.AST_DWLoop)
				transformLoop() ;
			return true ;
		});
		ast.walk(asyncWalk) ;
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

	function asyncDefine(ast) {
		var asyncWalk = new U2.TreeWalker(function(node, descend){
			if (node instanceof U2.AST_UnaryPrefix && node.operator=="async") {
				// 'async' is unary operator that takes a function as it's operand, 
				// OR, for old-style declarations, a unary negative expression yielding a function, e.g.
				// async function(){} or async-function(){}
				// The latter form is deprecated, but has the advantage of being ES5 syntax compatible
				var fn = node.expression ;
				if (!(opts.es7) && (fn instanceof U2.AST_UnaryPrefix && fn.operator=='-'))
					fn = fn.expression.clone() ;
				if ((fn instanceof U2.AST_Function) || (fn instanceof U2.AST_Defun)) {
					var replace = fn.clone() ;
					if (replace instanceof U2.AST_Defun) {
						replace.needs_parens = function(){ return true };
					}
					/* Replace any occurrences of "return" for the current function (i.e., not nested ones)
					 * with a call to "$return" */
					var fnBody = fn.body.map(function(sub){
						var ast = mapReturns(sub) ;
						ast.walk(asyncWalk) ;
						return ast ;
					}) ;

					var funcback = new U2.AST_Function({
						argnames:[new U2.AST_SymbolFunarg({name:config.$return}),
						          new U2.AST_SymbolFunarg({name:config.$error})],
						          body:fnBody
					}) ;
					setCatch(funcback,config.$error) ;
					if (opts.promises) {
						replace.body = [new U2.AST_Return({
							value:new U2.AST_New({
								expression:new U2.AST_SymbolRef({name:"Promise"}),
								args:[funcback]
							})
						})] ;
					} else {
						replace.body = [new U2.AST_Return({
							value:new U2.AST_Call({
								expression:new U2.AST_Dot({
									expression: funcback,
									property: "$asyncbind"
								}),
								args:[new U2.AST_This(),getCatch(asyncWalk)]
							})
						})] ;
					}

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

	/* Remove un-necessary nested blocks and crunch down empty function implementations */
	function cleanCode(ast) {
		var asyncWalk ;

		// Find references to continuations
		asyncWalk = new U2.TreeWalker(function(node, descend){
			descend();
			if ((node instanceof U2.AST_SymbolRef) && continuations[node.name] && node.thisCall) {
				if (continuations[node.name].ref) {
					// We alreday have a reference to this continuation,
					// so since it's used more than once, we'll remove it
					delete continuations[node.name] ;
				} else {
					continuations[node.name].ref = node.thisCall ;
				}
			}
			return true ;
		}) ;
		ast.walk(asyncWalk) ;

		var calls = Object.keys(continuations).map(function(c){ return continuations[c].ref }) ;
		asyncWalk = new U2.TreeWalker(function(node, descend){
			descend();
			if (calls.indexOf(node)>=0) {
				var parent = asyncWalk.parent() ;
				if (parent instanceof U2.AST_Return) {
					var sym = node.expression.expression.name ;
					coerce(parent,new U2.AST_BlockStatement({body:toArray(continuations[sym].def.body).concat(new U2.AST_Return())})) ;
					coerce(continuations[sym].def,new U2.AST_EmptyStatement()) ;
				}
			}
			return true ;
		}) ;
		ast.walk(asyncWalk) ;

		// Coalese BlockStatements
		asyncWalk = new U2.TreeWalker(function(node, descend){
			descend();
			// If this node is a vanilla block (no controlling entity)
			// and our parent also has a block body, merge the two
			if (Array.isArray(node.body)) {
				for (var n=node.body.length-1; n>=0; n--) {
					if (node.body[n].TYPE=="BlockStatement") {
						node.body.splice.apply(node.body,[n,1].concat(node.body[n].body))
					}
				}
			}
			return true ;
		}) ;
		ast.walk(asyncWalk) ;

		// Truncate BlockStatements with a Jump (break;continue;return;throw) inside
		asyncWalk = new U2.TreeWalker(function(node, descend){
			descend();
			if (node instanceof U2.AST_Jump) {
				var parent = asyncWalk.parent(0) ;
				if (Array.isArray(parent.body)) {
					var i = parent.body.indexOf(node) ;
					if (i>=0) 
						parent.body.splice(i+1,parent.body.length-(i+1)) ;
				}
			}
			return true ;
		}) ;
		ast.walk(asyncWalk) ;

		return ast ;
	}
}

var nodent ;
function asyncify(promiseProvider) {
	promiseProvider = promiseProvider || nodent.Promise ;
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
			if (typeof obj[k]==='function' && (!o[k+suffix] || !o[k+suffix].isAsync) && filter(k,o)) {
				o[k+suffix] = function() {
					var a = Array.prototype.slice.call(arguments) ;
					var resolver = function($return,$error) {
						var cb = function(err,ok){
							if (err)
								return $error(err) ;
							if (arguments.length==2)
								return $return(ok) ;
							return $return(Array.prototype.slice.call(arguments,1)) ;
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
			try {
				opts = opts || {} ;
				if (opts.promises)
					opts.es7 = true ;
				sourceMapping = sourceMapping || config.sourceMapping ; 

				var pr = nodent.parse(code,origFilename,sourceMapping,opts);
				nodent.asynchronize(pr,sourceMapping,opts) ;
				nodent.prettyPrint(pr,sourceMapping,opts) ;
				return pr ;
			} catch (ex) {
				if (ex.constructor.name=="JS_Parse_Error") 
					console.warn(reportParseException(ex,code,origFilename)) ;
				else
					console.warn("NoDent JS: Warning - couldn't parse "+origFilename+" (line:"+ex.line+",col:"+ex.col+"). Reason: "+ex.message) ;
				if (ex instanceof Error)
					throw ex ;
				else {
					var wrapped = new Error(ex.toString()) ;
					wrapped.causedBy = ex ;
					throw wrapped ;
				}
			}
		};
		nodent.parse = function(code,origFilename,sourceMapping,opts) {
			sourceMapping = sourceMapping || config.sourceMapping ; 
			if (sourceMapping==2)
				origFilename = origFilename+".nodent" ;
			var r = { origCode:code.toString(), filename:origFilename } ;
			r.ast = U2.parse(r.origCode, {strict:false,filename:r.filename}) ;
			r.ast.figure_out_scope();
			return r ;
		};
		nodent.asynchronize = asynchronize ;
		nodent.prettyPrint = function(pr,sourceMapping,opts) {
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
				var mapUrl = "\n"
					+"\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,"+btoa(JSON.stringify(jsmap))
					+"\n" ;
			}
			pr.code = str.toString()+(map?mapUrl:"") ;
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
							var pr = nodent.compile(content.toString(),req.url,2,options.compiler);
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
		};
		nodent.AST = U2;

		function makeThenable(fn) {
			
		}
		Object.defineProperty(Function.prototype,"$asyncbind",{
			value:function(self,catcher) {
				var fn = this ;
				fn.isAsync = true ;
				var p = function(result,error){
					try {
						return fn.call(self,result,error);
					} catch (ex) {
						return catcher.call(self,ex);
					}
				} ; 
				p.then = p ;
				return p ;
			}
		}) ;

		// Give a funcback a thenable interface, so it can be invoked by Promises.
		nodent.Promise = nodent.Thenable = function(resolver) {
			var fn = function(result,error){
				try {
					return resolver.call(this,result,error) ;
				} catch(ex) {
					return error.call(this,ex) ;
				}
			} ;
			fn.then = fn ;
			return fn ;
		};

		nodent.asyncify = asyncify ;
		/**
		 * We need a global to handle funcbacks for which no error handler has ever been deifned.
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
		 * @params
		 * idx			The argument index that is the 'callback'. 'undefined' for the final parameter
		 * errorIdx		The argument index of the callback that holds the error. 'undefined' for no error value
		 * resultIdx 	The argument index of the callback that holds the result. 'undefined' for the argument after the errorIdx (errorIdx != undefined)
		 * promiseProvider	For promises, set this to the module providing Promises.
		 */
		Object.defineProperty(Function.prototype,"noDentify",{
			value:function(idx,errorIdx,resultIdx,promiseProvider) {
				promiseProvider = promiseProvider || nodent.Promise ;
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

		function matches(str,match){
			if (!match)
				return false ;
			if (typeof match==="string")
				return match==str ;
			if ("test" in match)
				return match.test(str) ;
		}

		var stdJSLoader = require.extensions['.js'] ; 
		if (initOpts.useDirective || initOpts.useES7Directive || initOpts.usePromisesDirective) {
			require.extensions['.js'] = function(mod,filename) {
				var content = stripBOM(fs.readFileSync(filename, 'utf8'));
				var parseOpts = {
						promises: !!content.match(initOpts.usePromisesDirective),
						es7: !!content.match(initOpts.useES7Directive)
				} ; 
				if (parseOpts.promises) parseOpts.es7 = true ;
				if (parseOpts.promises || parseOpts.es7 || content.match(initOpts.useDirective)) 
					return require.extensions[initOpts.extension](mod,filename,parseOpts) ;
				return stdJSLoader(mod,filename) ;
			} ;
		}

		require.extensions[initOpts.extension] = function(mod, filename, parseOpts) {
			try {
				var content = stripBOM(fs.readFileSync(filename, 'utf8'));
				var pr = nodent.parse(content,filename,parseOpts);
				if (!parseOpts) {
					parseOpts = {} ;
					for (var i=0; i<pr.ast.body.length; i++) {
						if (pr.ast.body[i] instanceof U2.AST_Directive) {
							var test = "'"+pr.ast.body[i].value+"'" ;
							parseOpts.promises = matches(test,initOpts.usePromisesDirective) ;
							parseOpts.es7 = parseOpts.promises || matches(test,initOpts.useES7Directive) ;
						}
					}
				}

				nodent.asynchronize(pr,undefined,parseOpts) ;
				nodent.prettyPrint(pr,undefined,parseOpts) ;
				mod._compile(pr.code, pr.filename);
			} catch (ex) {
				if (ex.constructor.name=="JS_Parse_Error") 
					console.warn(reportParseException(ex,content,filename)) ;
				throw ex ;
			}
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
if (require.main===module && process.argv[2]) {
	// Initialise nodent
	initialize(process.env.NODENT_OPTS && JSON.parse(process.env.NODENT_OPTS)) ;	
	var path = require('path') ;
	var mod = path.resolve(process.argv[2]) ;
	require(mod);
}
