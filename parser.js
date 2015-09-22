

var acorn = require("acorn");
var acornParse = acorn.parse ;
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

module.exports = {
	base: acornBase,
	parse: acorn.parse
} ;
