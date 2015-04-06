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

/* New node types that we use */
U2.AST_DeletedNode = U2.DEFNODE("DeletedNode", null, {
    $documentation: "A deleted node",
    _walk: function(visitor) {}
}, U2.AST_Node);
U2.AST_DeletedNode.DEFMETHOD("_codegen",function(self,output){}) ;

U2.AST_Node.DEFMETHOD("setProperties",function(props){
	var prevClone = this.clone ;
	var prevCodeGen = this._codegen ;
	this.props = this.props || {} ;
	for (var k in props)
		this.props[k] = props[k] ;

	this.clone = function() {
		var n = prevClone.apply(this,arguments) ;
		n.setProperties(this.props) ;
		return n ;
	}
// Useful for debugging, not much else
/*	
	this._codegen = function(self,output) {
		if (self.props) {
			var keys = Object.keys(self.props) ;//.filter(function(k){return k[0]=="$"}) ;
			if (keys.length)
				output.print("/* "+keys.map(function(k){
					return k+":"+self.props[k]
				})+" *"+"/") ;
		}
		var r = prevCodeGen.call(this,self,output) ;
		return r ;
	}*/
}) ;

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
function info(node,quiet) {
	if (Array.isArray(node))
		return node.map(info) ;
	var s = "" ;
	for (var q = node.__proto__; q.TYPE; q=q.__proto__)
		s += q.TYPE+"." ;
	return s+(quiet?"":":"+node.print_to_string()) ;
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
		useGeneratorsDirective:/['"]use\s+nodent\-generators['"]/,
		extension:'.njs',
		$return:"$return",
		$error:"$error",
		log:function(msg){ console.warn("Nodent: "+msg) },
		bindAwait:"$asyncbind",
		bindAsync:"$asyncbind",
		bindLoop:"$asyncbind",
		// Pre-ES7 tokens: for async-function() ** OBSOLETE **
		// define:"-",
		// async:"async",
		// Pre-ES7 tokens for async assignment
		$except:"$except",
		assign:"<<=",
		ltor:true	/* true: val <<= async(),   false: async() <<= val */
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

	parseOpts = {} ;

	if (typeof code=="string") {
		var parseOpts = {
				promises: !!code.match(initOpts.usePromisesDirective),
				es7: !!code.match(initOpts.useES7Directive),
				generators: !!code.match(initOpts.useGeneratorsDirective),
				es5assign: !!code.match(initOpts.useDirective)
		} ; 
		if (parseOpts.promises) parseOpts.es7 = true ;
	} else {
		// code is an AST
		for (var i=0; i<pr.ast.body.length; i++) {
			if (code.body[i] instanceof U2.AST_Directive) {
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
			initOpts.log("Invalid combination of 'use nodent*' directives. Assuming 'use nodent-es7'") ;
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

function getCatch(w,nesting) {
	nesting = nesting || 0 ;
	for (var n=w.stack.length-1;n>0;n--)
		if (w.stack[n].catcher) {
			if (!nesting)
				return w.stack[n].catcher.map(function(sym){return new U2.AST_SymbolRef({name:sym})}) ;
			nesting -= 1 ;
		}
	return [new U2.AST_SymbolRef({name:config.$error})] ; ;
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

/* Given a 'parent' node, get the reference (i.e. a member) that contains target. Often
 * this will be 'parent.body', but it might be 'parent.body[x]', or even 'parent.alternative[3]'
 * or any other reference. We need to do this so we can manipulate blocks containing the target.
 * NB: Any structural change to the parent after a ref is generated is likely to invalidate
 * the ref, which will need to be re-referenced */
function parentRef(walker,depth) {
	var parent = walker.stack[walker.stack.length-(depth?depth+1:2)] ;
	var target = walker.stack[walker.stack.length-(depth||1)] ;

	if (typeof parent!=='object')
		throw new Error("Bad parent "+parent) ;
	
	// This is NOT a nice function. It examines each of the members of
	// the parent and if it looks like an AST_Node, or an array of AST_Nodes
	// it checks to see if the target is there, and if succesful returns the 
	// ref.
	var k = Object.keys(parent) ;
	var ref ;
	if (k.some(function(key){
		if (parent[key] instanceof U2.AST_Node) {
			if (parent[key]===target) {
				ref = {parent:parent,field:key,self:target} ;
				return true ;
			}
		} else if (Array.isArray(parent[key]) && (parent[key][0] instanceof U2.AST_Node)) {
			var j = parent[key].indexOf(target) ;
			if (j>=0) {
				ref = {
					parent:parent,
					field:key,
					self:target,
					get index(){
						var l = parent[key].indexOf(target) ;
						if (l>=0) return l ;
						throw new Error("No parent for "+info(target)) ;
					}} ;
				return true ;
			}
		}
	}) && ref) 
		return ref ;
	throw new Error("No parent for "+info(target)) ;
}

/* Find a target in a parent, and ensure the target is part of a block,
 * if necessary by creating an intermediate BlockStatement. Return the
 * new parent (i.e. the same as passed, or the BlockStatement) in the ref.
 * This means that the returned ref will always have an 'index' and the 
 * target will be transformed so that always is within a block */
function parentBlockRef(walker,depth) {
	var ref = parentRef(walker,depth) ;

	if ('index' in ref) {
		return ref ;
	}

	var target = ref.self ;
	var block = new U2.AST_BlockStatement({body:[target]}) ;
	ref.parent[ref.field] = block ;
	return {parent:block,
		field:'body',
		self:target,
		get index(){
			var l = block.body.indexOf(target) ;
			if (l>=0) return l ;
			throw new Error("No parent for "+info(target)) ;
		}} ;
}

function deleteRef(ref) {
	if ('index' in ref) {
		return ref.parent[ref.field].splice(ref.index,1)[0] ;
	}
	var self = ref.self ; 
	ref.parent[ref.field] = new U2.AST_DeletedNode() ;
	if (ref.parent instanceof U2.AST_SimpleStatement) {
		coerce(ref.parent,ref.parent[ref.field]);
	}
	return self ;
}

function setRef(ref,node) {
	var prev ;
	if ('index' in ref) {
		prev = ref.parent[ref.field][ref.index] ;
		ref.parent[ref.field][ref.index] = node ;
	} else {
		prev = ref.parent[ref.field] ;
		ref.parent[ref.field] = node ;
	}
	return prev ;
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

function asynchronize(pr,sourceMapping,opts,initOpts) {
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

	if (opts.generators) {
		pr.ast = asyncSpawn(pr.ast) ;
	} else {
		// Because we create functions (and scopes), we need all declarations before use
		pr.ast = hoistDeclarations(pr.ast) ;

		// Loops are asynchronized in an odd way - the loop is turned into a function that is
		// invoked through tail recursion OR callback. They are like the inner functions of
		// async functions to allow for completion and throwing
		pr.ast = asyncLoops(pr.ast) ;
		
		// Convert async functions and their contained returns & throws
		pr.ast = asyncDefine(pr.ast) ;
		
		// Handle the various JS control flow keywords by splitting into continuations that could
		// be invoked asynchronously
		pr.ast = walkDown(pr.ast,[mapTryCatch,mapIfStmt,mapSwitch]) ;

		// Map awaits by creating continuations and passing them into the async resolver
		pr.ast = asyncAwait(pr.ast) ;

		// Remove guff generated by transpiling
		pr.ast = cleanCode(pr.ast) ;
	}
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
		var ctn = makeFn(name,body) ;
		continuations[name] = {def:ctn} ;
		ctn.setProperties({continuation:true}) ;
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
		name.setProperties({thisCall:n}) ;
		n.setProperties({thisCallName:name.name}) ;
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
	function mapReturns(n,containers){
		if (Array.isArray(n)) {
			return n.map(function(m){return mapReturns(m,containers)}) ;
		}
		var lambdaNesting = 0 ;
		var returnMapper = new U2.TreeTransformer(function(node,descend) {
			if ((node instanceof U2.AST_Return) && !node.mapped) {
				var repl,value ;
				if (lambdaNesting > 0) {
					if ((node.value instanceof U2.AST_UnaryPrefix) && node.value.operator == "async") {
						value = [node.value.expression.clone()] ;
						repl = node.clone() ; //repl = new U2.AST_Return({value:undefined}) ;
					}
				} else {
					if (!containers) {
						repl = node.clone() ;
						value = repl.value?[repl.value.clone()]:[] ;
					}
				}
				if (!value) {
					descend(node, this);
					return node ;
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
				}
			} else if (node instanceof U2.AST_Throw) {
				var value ;
				if (lambdaNesting>0) {
					if ((node.value instanceof U2.AST_UnaryPrefix) && node.value.operator == "async") {
						value = node.value.expression.clone() ;
					}
				} else {
					if (!containers) {
						value = node.value.clone() ;
					}
				}
				
				if (!value) {
					descend(node, this);
					return node ;
				} else {
					var repl = new U2.AST_Return({
						value:new U2.AST_Call({
							expression:getCatch(returnMapper)[0],
							args:[value]
						})
					}) ;
					repl.start = repl.value.start = node.start ;
					repl.end = repl.value.end = node.end ;
					repl.mapped = true ;
					return repl ; 
				}
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
	function mapIfStmt(ifStmt, asyncWalk){
		if ((ifStmt instanceof U2.AST_If) && 
				(containsAwait(ifStmt.body) || (ifStmt.alternative && containsAwait(ifStmt.alternative)))) {

			var symName = "$post_if_"+generateSymbol(ifStmt.condition) ;
			var synthBlock = new U2.AST_BlockStatement({body:[ifStmt]}) ; 

			var ref = parentRef(asyncWalk) ;
			if ('index' in ref) {
				var idx = ref.index ;
				var deferredCode = ref.parent[ref.field].splice(idx+1,ref.parent[ref.field].length-(idx+1)) ;  
				ref.parent[ref.field][idx] = synthBlock ;
				if (deferredCode.length) {
					var call = new U2.AST_Return({value:thisCall(symName)}) ;
					synthBlock.body.unshift(asyncWalk.walkDown(makeContinuation(symName,deferredCode))) ;
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
						asyncWalk.walkDown(cond) ;
					}

					transformConditional(ifStmt.body) ;
					if (ifStmt.alternative) {
						transformConditional(ifStmt.alternative) ;
					}
				}
			} else {
				ref.parent[ref.field] = synthBlock ;
			}
		}
	}
	
	function mapSwitch(switchStmt, asyncWalk){
		if ((switchStmt instanceof U2.AST_Switch) && containsAwait(switchStmt.body)){
			var ref = parentBlockRef(asyncWalk) ;

			var j = ref.index+1 ;
			var deferredCode = ref.parent[ref.field].splice(j,ref.parent[ref.field].length-j) ;  
			if (deferredCode[deferredCode.length-1] instanceof U2.AST_Break)
				ref.parent[ref.field].push(deferredCode.pop()) ;
			var symName = "$post_switch_"+generateSymbol(switchStmt.expression) ;
			var deferred = thisCall(symName) ; 
			var synthBlock = new U2.AST_BlockStatement({body:[switchStmt]}) ; 

			if (deferredCode.length) {
				synthBlock.body.unshift(makeContinuation(symName,deferredCode)) ;
				synthBlock.body.push(new U2.AST_SimpleStatement({body:deferred.clone()})) ;
			} else {
				deferred = null ;
			}
			ref.parent[ref.field][ref.index] = synthBlock ;
			synthBlock.body[0].body.forEach(function(n){ asyncWalk.walkDown(n) } ) ;
			
			// Now transform each case so that 'break' looks like return <deferred>
			switchStmt.body.forEach(function(caseStmt,idx){
				if (!(caseStmt instanceof U2.AST_SwitchBranch)) {
					throw new Error("switch contains non-case/default statement: "+caseStmt.TYPE) ;
				}
				if (containsAwait(caseStmt)) {
					var end = caseStmt.body[caseStmt.body.length-1] ;
					if (end  instanceof U2.AST_Break) {
						caseStmt.body[caseStmt.body.length-1] = new U2.AST_Return({value:deferred.clone()}) ;
					} else if (end instanceof U2.AST_Exit) {
						// Do nothing - block ends in return or throw
					} else {
						initOpts.log(pr.filename+" - switch-case fall-through not supported - added break") ;
						caseStmt.body.push(new U2.AST_Return({value:deferred.clone()})) ;
					}
				}
			}) ;
			return true ;
		}
	}

	function mapTryCatch(node, asyncWalk) {
		if ((node instanceof U2.AST_Try) && containsAwait(node)) {
			var continuation ;
			var ref = parentRef(asyncWalk) ;
			if ('index' in ref) {
				var i = ref.index+1 ;
				var afterTry = ref.parent[ref.field].splice(i,ref.parent[ref.field].length-i) ;
				if (afterTry.length) {
					var ctnName = "$post_try_"+generateSymbol() ;
					ref.parent[ref.field].unshift(makeContinuation(ctnName,afterTry)) ;
					continuation = thisCall(ctnName) ; 
				}
			} else {
				throw new Error(pr.filename+" - malformed try/catch blocks") ;
			}

			node.body = toArray(node.body) ;
			if (continuation) {
				node.body.push(continuation.clone()) ;
				node.bcatch.body.push(continuation.clone()) ;
			}
			if (node.bcatch) {
				var symCatch = "$catch_"+generateSymbol(node.bcatch.argname) ;
				// catcher is not a continuation as it has arguments
				var catcher = makeFn(symCatch,node.bcatch.body,[node.bcatch.argname.clone()]) ; 
				node.bcatch.body = [thisCall(symCatch,[node.bcatch.argname.clone()])] ;
				node.body.unshift(catcher) ;
			}
			if (node.bfinally) { /** TODO: Not yet working! **/
				var symFinal = "finally_"+generateSymbol() ;
				var finalize = makeContinuation(symFinal,node.bfinally.body) ; 
				node.bfinally.body = [finalize,thisCall(symFinal)] ;
			}
			setCatch(node.body,[symCatch,symFinal]) ;
		}
	}
	
	function walkDown(ast,mapper){
		var walked = [] ;
		function walkDownSubtree(node){
			walked.push(node) ;
			return walkDown(node,mapper) ;
		}
		
		ast.walk(new U2.TreeWalker(function(node,descend){
			if (walked.indexOf(node)>=0)
				return true ;
			
			this.walkDown = walkDownSubtree ;
			if (Array.isArray(mapper)) {
				var walk = this ;
				mapper.forEach(function(m){ 
					m(node,walk);
				}) ;
			} else {
				mapper(node,this) ;
			}
			descend() ;
			return true ;
		})) ;
		return ast ;
	}

	function asyncAwait(ast,inAsync) {
		if (!opts.es7) {
			// Only load deprecated ES5 behaviour if the app uses it.
			initOpts.log("Nodent ES5 Syntax is deprecated - replace with ES7 async and await keywords") ;
			var asyncAssignTransfom = require('./es5plus')(U2,config) ;
			return ast.transform(asyncAssignTransfom) ;
		}

		var asyncWalk = new U2.TreeWalker(function(node, descend){
			descend();
			if (node instanceof U2.AST_UnaryPrefix && node.operator=="await") {
				/* Warn if this await expression is not inside an async function, as the return
				 * will depend on the Thenable implementation, and references to $return might
				 * not resolve to anything */
				inAsync = inAsync || asyncWalk.stack.some(function(ancestor){
					return ancestor.props && ancestor.props.wasAsync ;
				}) ;
				
				if (!inAsync) {
					if (opts.promises)
						initOpts.log(pr.filename+" - Warning: '"+node.print_to_string()+"' used inside non-async function. 'return' value Promise runtime-specific") ;
					else
						initOpts.log(pr.filename+" - Warning: '"+node.print_to_string()+"' used inside non-async function. 'return' value from await is synchronous") ;
				}
				
				var parent = asyncWalk.parent(0) ;
				if ((parent instanceof U2.AST_Binary) && (parent.operator=="||" || parent.operator=="&&") && parent.right===node) {
					initOpts.log(pr.filename+" - Warning: '"+parent.print_to_string()+"' on right of "+parent.operator+" will always evaluate '"+node.print_to_string()+"'") ;
				}
				if ((parent instanceof U2.AST_Conditional) && parent.condition!==node) {
					initOpts.log(pr.filename+" - Warning: '"+parent.print_to_string()+"' will always evaluate '"+node.print_to_string()+"'") ;
				}

				var result = new U2.AST_SymbolRef({name:"$await_"+generateSymbol(node.expression)}) ;
				var expr = node.expression.clone() ;
				coerce(node,result) ;

				// Find the statement containing this await expression (and it's parent)
				var stmt ;
				for (var n=0; n<asyncWalk.stack.length; n++) {
					if (asyncWalk.stack[asyncWalk.stack.length-(n+1)] instanceof U2.AST_Statement) {
						stmt = parentBlockRef(asyncWalk,n+1) ;
						break ;
					}
				}
				if (!stmt)
					throw new Error("Illegal await not contained in a statement") ;

				var i = stmt.index ;
				var callBack = stmt.parent[stmt.field].splice(i,stmt.parent[stmt.field].length-i).slice(1); 
				// If stmt is only a reference to the result, suppress the result 
				// reference as it does nothing
				if (!stmt.self.equivalent_to(result))
					callBack.unshift(stmt.self);
				
				// Wrap the callback statement(s) in a Block and transform them
				var cbBody = new U2.AST_BlockStatement({body:cloneNodes(callBack)}) ;
				cbBody = asyncAwait(cbBody,inAsync) ;

				var returner = new U2.AST_Function({argnames:[],body:[]}) ;
				if (cbBody.body.length) {
					returner = new U2.AST_Function({
						argnames:[result.clone()],
						body:cbBody.body
					}) ;
					returner = new U2.AST_Call({
						expression:new U2.AST_Dot({
							expression: returner,
							property: initOpts.bindAwait
						}),
						args:[new U2.AST_This(),getCatch(asyncWalk)[0]]
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
					args:[returner,getCatch(asyncWalk)[0]]
				}) ;

				stmt.parent[stmt.field].push(new U2.AST_Return({ value:call })) ;
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
				var symExit = "$exit_"+generateSymbol(condition) ;
				var loop = new U2.AST_SymbolRef({name:symName}) ;

				// How to exit the loop
				var mapBreak = new U2.AST_Return({
					value:new U2.AST_UnaryPrefix({
						operator:"void",
						expression:new U2.AST_Call({
							args:[],
							expression:new U2.AST_SymbolRef({name:symExit})
						})})}) ; 

				// How to continue the loop
				var symContinue = "$next_"+generateSymbol() ;
				var defContinue = makeContinuation(symContinue,[new U2.AST_Return({value:
					new U2.AST_Call({
						args:[new U2.AST_SymbolRef({name:symExit}),
						      new U2.AST_SymbolRef({name:config.$error})],
						      expression:loop.clone()
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
						if (n instanceof U2.AST_Return) {
							n.value = new U2.AST_Call({
								expression:new U2.AST_SymbolRef({name:config.$return}),
								args:[n.value.clone()]}) ; 
							return true ;
						} else if (n instanceof U2.AST_Break) {
							coerce(n,mapBreak.clone()) ;
						} else if (n instanceof U2.AST_Continue) {
							coerce(n,mapContinue.clone()) ;
						} else if (n instanceof U2.AST_Lambda) {
							return true ;
						} 
					})) ;
				}

				body.push(mapContinue.clone());

				var subCall = new U2.AST_Defun({
					name:loop.clone(),
					argnames:[new U2.AST_SymbolRef({name:symExit}),
						      new U2.AST_SymbolRef({name:config.$error})],
					body:[defContinue]
				});

				var nextTest ;
				if (node instanceof U2.AST_Do) {
					defContinue.body = [new U2.AST_If({condition:condition.clone(),
						body:new U2.AST_BlockStatement({body:defContinue.body}),
						alternative:new U2.AST_Return({value:new U2.AST_Call({
							expression:new U2.AST_SymbolRef({name:symExit}),
							args:[]
						})})
					})] ;
					subCall.body = [defContinue].concat(body) ;
				} else {
					var nextTest = new U2.AST_If({condition:condition.clone(),
						body:new U2.AST_BlockStatement({body:body}),
						alternative:mapBreak.clone()
					}) ;
					subCall.body.push(nextTest) ;
				}

				var replace = new U2.AST_SimpleStatement({body:
					new U2.AST_UnaryPrefix({operator:'await',
						expression:new U2.AST_Call({
							expression:new U2.AST_Dot({
								expression: subCall,
								property: initOpts.bindLoop
							}),
							args:[new U2.AST_This(),getCatch(asyncWalk)[0]]
						})
					})
				});

				var ref = parentBlockRef(asyncWalk) ;
				if (init)
					ref.parent[ref.field].splice(ref.index,1,init.clone(),replace) ;
				else
					ref.parent[ref.field][ref.index] = replace ;
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
				// "async" is unary operator that takes a function as it's operand, 
				// OR, for old-style declarations, a unary negative expression yielding a function, e.g.
				// async function(){} or async-function(){}
				// The latter form is deprecated, but has the advantage of being ES5 syntax compatible
				var fn = node.expression ;
				if (!(opts.es7) && (fn instanceof U2.AST_UnaryPrefix && fn.operator=='-'))
					fn = fn.expression.clone() ;
				if ((fn instanceof U2.AST_Function) || (fn instanceof U2.AST_Defun)) {
					var replace = fn.clone() ;
					/* Replace any occurrences of "return" for the current function (i.e., not nested ones)
					 * with a call to "$return" */
					var fnBody = fn.body.map(function(sub){
						var ast = mapReturns(sub) ;
						ast.walk(asyncWalk) ;
						return ast ;
					}) ;

					/* Removed as ES7 now has a (tiny) runtime: asyncbind. Prior to
					 * using $asyncbind, each async function caught it's own exceptions
					 * and was invoked via bind(), so no exception handler was passed. 
					 * $asyncbind passes the exception handler as a parameter, and the 
					 * invoked function doesn't require a try{} catch() {}
					 */
					/*if (!opts.promises) {
						fnBody = [new U2.AST_Try({body:fnBody,bcatch: new U2.AST_Catch({
							argname:new U2.AST_SymbolFunarg({name:initOpts.$except}),
							body:[thisCall(getCatch(asyncWalk)[0],[new U2.AST_SymbolRef({name:initOpts.$except})])]})})] ;
					}*/
					
					var funcback = new U2.AST_Function({
						argnames:[new U2.AST_SymbolFunarg({name:config.$return}),
						          new U2.AST_SymbolFunarg({name:config.$error})],
						          body:fnBody
					}) ;
					funcback.setProperties({wasAsync:true}) ;
					setCatch(funcback,[config.$error]) ;
					funcback = new U2.AST_Call({
						expression:new U2.AST_Dot({
							expression: funcback,
							property: initOpts.bindAsync
						}),
						args:[new U2.AST_This(),getCatch(asyncWalk)[0]]
					}) ;
					if (opts.promises) {
						/* 
						 * Promises logically only need .bind() here, as
						 * the surrounding TryCatch will handle any exceptions,
						 * but for some V8 specific reason, .bind() is around
						 * three times slower than using $asyncbind(), which
						 * wraps the function in context and (unecessarily)
						 * handles exceptions.
						 * 
						funcback = new U2.AST_Call({
							expression:new U2.AST_Dot({
								expression: funcback,
								property: "bind"
							}),
							args:[new U2.AST_This()]
						}) ;
						*/
						replace.body = [new U2.AST_Return({
							value:new U2.AST_New({
								expression:new U2.AST_SymbolRef({name:"Promise"}),
								args:[funcback]
							})
						})] ;
					} else {
						replace.body = [new U2.AST_Return({
							value:funcback
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

	/*
	 * Rewrite
			async function <name>?<argumentlist><body>
		to
			function <name>?<argumentlist>{ return function*() {<body>}.$asyncspawn(); } 
	 */
	function asyncSpawn(ast) {
		var asyncWalk = new U2.TreeWalker(function(node, descend){
			if (node instanceof U2.AST_UnaryPrefix && node.operator=="async") {
				descend() ;
				// "async" is unary operator that takes a function as it's operand, 
				// async function(){} 
				var fn = node.expression ;
				
				if ((fn instanceof U2.AST_Function) || (fn instanceof U2.AST_Defun)) {
					var ref = parentRef(asyncWalk) ;
					var generator = new U2.AST_Defun({
						name:new U2.AST_SymbolRef({name:"*"}),
						argnames:[new U2.AST_SymbolFunarg({name:config.$return}),
						          new U2.AST_SymbolFunarg({name:config.$error})],
						body:mapReturns(fn.body,true).concat(new U2.AST_Return({value:new U2.AST_SymbolRef({name:config.$return})}))
					}) ;
					var awaits = scopedNodes(generator,function(n){
						return (n instanceof U2.AST_UnaryPrefix) && n.operator=="await" ;
					}) ;
					awaits.forEach(function(r){
						r.self.operator = "yield" ;
						r.self.needs_parens = function(){ return true };
					}) ;
					fn.body = [
					    new U2.AST_Return({value:
						    new U2.AST_Call({
								expression:new U2.AST_Dot({
									expression:generator,
									property:"$asyncspawn"}),
								args:[new U2.AST_SymbolRef({name:"Promise"}),new U2.AST_This()]
						})})] ;

					fn.needs_parens = function(){ return false };
					setRef(ref,fn) ;
					return true ;
				}
			}
		});
		ast.walk(asyncWalk) ;
		return ast ;
	}

	/* Find all nodes within this scope matching the specified function */
	function scopedNodes(ast,matching) {
		var matches = [] ;
		var walk = new U2.TreeWalker(function(node, descend){
			if (node === ast)
				return ;
			
			if (matching(node,walk)) {
				matches.push(parentRef(walk)) ;
				return true ;
			}
			if (node instanceof U2.AST_Scope) {
				return true ;
			}
		}) ;
		ast.walk(walk) ;
		return matches ;
	}
	
	/* Move directives, vars and named functions to the top of their scope */
	function hoistDeclarations(ast) {
		var asyncWalk = new U2.TreeWalker(function(node, descend){
			descend() ;
			if (node instanceof U2.AST_Scope) {
				var functions = scopedNodes(node,function hoistable(n){
					// YES: We're a named function, but not a continuation
					if ((n instanceof U2.AST_Lambda) && n.name) { 
						return !(n.props && n.props.continuation) ;
					}
					
					// YES: We're a named async function
					if ((n instanceof U2.AST_UnaryPrefix) 
							&& n.operator=="async"
							&& hoistable(n.expression))
						return true ;
					
					// No, we're not a hoistable function
					return false ;
				}) ;

				var hoistedFn = {} ;
				functions.forEach(function(ref) {
					// What is the name of this function (could be async, so check the expression if necessary)
					var symName = ref.self.name?ref.self.name.name:ref.self.expression.name.name ;
					if (symName in hoistedFn) {
						initOpts.log(pr.filename+" - Duplicate 'function "+symName+"()'") ;
					}
					hoistedFn[symName] = true ;
					var fnSym = new U2.AST_SymbolRef({name:symName}) ;

					// In some contexts we need to leave the sym in place, in others we can delete it
					// Don't hoist functions that are part of an expression or otherwise not in a 'body'
					var movedFn ;
					if (ref.field!=='body')
						movedFn = setRef(ref,fnSym) ;
					else
						movedFn = deleteRef(ref) ;
					
					if (movedFn instanceof U2.AST_Function)
						movedFn = new U2.AST_Defun(movedFn) ;
					node.body.unshift(movedFn) ;
				}) ;
				
				var vars = scopedNodes(node,function(n){
					return (n instanceof U2.AST_Var) ;
				}) ;
				
				if (vars.length) {
					var definitions = [] ;
					vars.forEach(function(ref){
						if ((ref.parent instanceof U2.AST_For || ref.parent instanceof U2.AST_ForIn) && ref.field=="init")
							return ; // Don't hoist loop vars
						
						var self = ref.self ;
						var values = [] ;
						for (var i=0; i<self.definitions.length; i++) {
							var name = self.definitions[i].name.name ;
							if (definitions.indexOf(name)>=0) {
								initOpts.log(pr.filename+" - Duplicate 'var "+name+"' in '"+(node.name?node.name.name:"anonymous")+"()'") ;
							} else {
								definitions.push(name) ;
							}
							if (self.definitions[i].value) {
								var value = new U2.AST_Assign({
									left:new U2.AST_SymbolRef({name:name}),
									operator:'=',
									right:self.definitions[i].value.clone()
								}) ;
								if (!(ref.parent instanceof U2.AST_For))
									value = new U2.AST_SimpleStatement({body:value}) ;
								values.push(value) ;

							}
						}
						if (values.length==0)
							deleteRef(ref) ;
						else if (values.length==1) {
							setRef(ref,values[0]) ;
						} else {
							setRef(ref,new U2.AST_BlockStatement({body:values})) ;
						}
					}) ;

					if (definitions.length) {
						definitions = definitions.map(function(name){ return new U2.AST_VarDef({
							name: new U2.AST_SymbolVar({name:name})
						})}) ;
						if (!(node.body[0] instanceof U2.AST_Var)) {
							node.body.unshift(new U2.AST_Var({definitions:definitions})) ;
						} else {
							node.body[0].definitions = node.body[0].definitions.concat(definitions) ;
						}
					}
				}
				
				var directives = scopedNodes(node,function(n){
					return (n instanceof U2.AST_Directive) ;
				}) ;
				directives.forEach(function(ref){
					node.body.unshift(deleteRef(ref)) ;
				}) ;
			}
			return true ;
		}) ; 
		ast.walk(asyncWalk) ;
		return ast ;
	}

	function replaceSymbols(ast,from,to) {
		var walk = new U2.TreeWalker(function(node,descend){
			descend() ;
			if (node.TYPE=="SymbolRef" && node.name==from) {
				coerce(node,new U2.AST_SymbolRef({name:to})) ;
			}
			return true ;
		}) ;
		ast.walk(walk) ;
	}

	/* Remove un-necessary nested blocks and crunch down empty function implementations */
	function cleanCode(ast) {
		var asyncWalk ;

		/* Inline continuations that are only referenced once */
		asyncWalk = new U2.TreeWalker(function(node, descend){
			descend();
			if ((node instanceof U2.AST_SymbolRef) && continuations[node.name] && node.props && node.props.thisCall) {
				if (continuations[node.name].ref) {
					delete continuations[node.name] ;
				} else {
					continuations[node.name].ref = node.props.thisCall ;
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
					coerce(continuations[sym].def,new U2.AST_DeletedNode()) ;
				}
			}
			return true ;
		}) ;
		ast.walk(asyncWalk) ;

		// Find declarations of functions of the form:
		// 		function [sym]() { return _call_.call(this) } 
		// or 
		// 		function [sym]() { return _call_() } 
		// and replace with:
		//		_call_
		// If the [sym] exists and is referenced elsewhere, replace those too. This
		// needs to be done recursively from the bottom of the tree upwards

		/* For either of the call forms above, return the actually invoked symbol name */
		function simpleCallName(node) {
			if ((node.TYPE=="Call") 
					&& node.args.length==0 
					&& node.expression instanceof U2.AST_SymbolRef) {
				return node.expression.name ;
			}
			
			if ((node.TYPE=="Call") 
					&& node.props && node.props.thisCallName) {
				return node.props.thisCallName ;
			}
			
			return null ;
		}
		
		var replaced = {} ;
		asyncWalk = new U2.TreeWalker(function(node, descend){
			descend();
			
			if (node instanceof U2.AST_Lambda) {
				if ((node.body[0] instanceof U2.AST_Return) && node.body[0].value) {
					var to = simpleCallName(node.body[0].value) ;
					if (to) {
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

		// Coalese BlockStatements
		asyncWalk = new U2.TreeWalker(function(node, descend){
			descend();
			// If this node is a block with vanilla BlockStatements
			// (not controlling entity), merge them
			if (Array.isArray(node.body)) {
				// Remove any empty statements from within the block
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
				var ref = parentRef(asyncWalk) ;
				if ('index' in ref) {
					var i = ref.index+1 ;
					while (i<ref.parent[ref.field].length) {
						// Remove any statements EXCEPT for function/var definitions
						if ((ref.parent[ref.field][i] instanceof U2.AST_Definitions) 
							|| ((ref.parent[ref.field][i] instanceof U2.AST_Lambda) 
								&& ref.parent[ref.field][i].name))
							i += 1 ;
						else
							ref.parent[ref.field].splice(i,1) ;
					}
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
				nodent.asynchronize(pr,sourceMapping,opts,initOpts) ;
				nodent.prettyPrint(pr,sourceMapping,opts) ;
				return pr ;
			} catch (ex) {
				if (ex.constructor.name=="JS_Parse_Error") 
					initOpts.log(reportParseException(ex,code,origFilename)) ;
				else
					initOpts.log("Warning - couldn't parse "+origFilename+" (line:"+ex.line+",col:"+ex.col+"). Reason: "+ex.message) ;
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

		nodent.thenTryCatch = function thenTryCatch(self,catcher) {
			var fn = this ;
			fn.isAsync = true ;
			var thenable = function(result,error){
				try {
					return fn.call(self,result,error);
				} catch (ex) {
					return catcher.call(self,ex);
				}
			} ; 
			thenable.then = thenable ;
			return thenable ;
		}
		Object.defineProperty(Function.prototype,"$asyncbind",
				{value:nodent.thenTryCatch,writeable:true}
			) ;
		
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

		Object.defineProperty(Function.prototype,"$asyncspawn",
				{value:nodent.spawnGenerator,writeable:true}
			) ;

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
			try {
				var content = stripBOM(fs.readFileSync(filename, 'utf8'));
				var pr = nodent.parse(content,filename,parseOpts);
				parseOpts = parseOpts || parseCompilerOptions(pr.ast,initOpts) ;
				nodent.asynchronize(pr,undefined,parseOpts,initOpts) ;
				nodent.prettyPrint(pr,undefined,parseOpts) ;
				mod._compile(pr.code, pr.filename);
			} catch (ex) {
				if (ex.constructor.name=="JS_Parse_Error") 
					initOpts.log(reportParseException(ex,content,filename)) ;
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
if (require.main===module && process.argv.length>=3) {
	// Initialise nodent
	var initOpts = (process.env.NODENT_OPTS && JSON.parse(process.env.NODENT_OPTS)) ; 
	initialize(initOpts) ;	
	var path = require('path') ;
	var n = 2 ;
	if (process.argv[n]=="--out") {
		// Compile & output, but don't require
		n += 1 ;
		var filename = path.resolve(process.argv[n]) ;
		var content = stripBOM(fs.readFileSync(filename, 'utf8'));
		var parseOpts = parseCompilerOptions(content,initOpts) ;
		if (!parseOpts) {
			parseOpts = {es7:true} ;
			console.warn("/* "+filename+": No 'use nodent' directive, assumed -es7 mode */") ;
		}
		
		var pr = nodent.parse(content,filename,parseOpts);
		nodent.asynchronize(pr,undefined,parseOpts,config) ;
		nodent.prettyPrint(pr,undefined,parseOpts) ;
		console.log(pr.code) ;
	} else {
		// Compile & require
		var mod = path.resolve(process.argv[n]) ;
		require(mod);
	}
}
