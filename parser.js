var acorn = require("acorn");
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
			return this.self ;
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

var comments ;
function acornParse(code) {
	comments = [] ;
	var ast = acorn.parse(code,{
		plugins:{nodent:true},
		ecmaVersion:6, // TODO: Set from option/config
		allowHashBang:true,
		allowReturnOutsideFunction:true,
		locations:true,
		onComment:comments
	}) ;
	
	// attach comments to the most tightly containing node
	treeWalker(ast,function(node,descend,path){
		descend() ;
		while (comments.length && 
				(node.loc.start.line >= comments[0].loc.start.line && node.loc.end.line>=comments[0].loc.end.line)) {
			node.$comments = node.$comments||[] ;
			node.$comments.push(comments.shift()) ;
		}
	}) ;
	return ast ;
}

module.exports = {
		parse: acornParse,
		treeWalker:treeWalker,
		_acorn:acorn
} ;
