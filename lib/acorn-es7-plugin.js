module.exports = function(acorn) { 
	acorn.plugins.asyncawait = function(parser){
		var tokens = {} ;
		var es7check = function(){} ;

		parser.extend("initialContext",function(base){
			return function(){
				if (this.options.ecmaVersion < 7) {
					es7check = function(node) {
						parser.raise(node.start,"async/await keywords only available in ES7") ;
					} ;
				} else {
					["async","await"].forEach(function(kw){
						tokens[kw] = new acorn.TokenType(kw,{beforeExpr: true, prefix: true, startsExpr: true, keyword: kw}) ;
					}) ;
				}
				return base.apply(this,arguments);
			}
		}) ;

		parser.extend("finishNode",function(base){
			return function(node,type){
				ret = base.call(this,node,type);
				if (type==='UnaryExpression' && node.operator==='await') {
					es7check(node) ;
					node.type = 'AwaitExpression' ;
				}
				if (type==='UnaryExpression' && node.operator==='async') {
					es7check(node) ;
					if (node.argument.type==='FunctionDeclaration' || 
							node.argument.type==='FunctionExpression' || 
							node.argument.type==='ArrowFunctionExpression') {
						var fn = node.argument ;
						delete node.argument ;
						delete node.operator ;
						delete node.prefix ;
						node.async = true ;
						Object.keys(fn).forEach(function(k){
							if (k!=='start')
								node[k] = fn[k] ;
						}) ;
					}
				}
				if (type==='ExpressionStatement' && node.expression.type==='FunctionExpression' && node.expression.async) {
					es7check(node) ;
					var fn = node.expression ;
					fn.type = 'FunctionDeclaration' ;
					delete node.expression ;
					Object.keys(fn).forEach(function(k){
						if (k!=='start')
							node[k] = fn[k] ;
					}) ;
				} 
				return ret ;
			}
		}) ;

		parser.extend("finishToken",function(base){
			return function(type,val){
				type = type || (tokens.hasOwnProperty(val) && tokens[val]) ;
				return base.call(this,type,val);
			}
		}) ;

		parser.extend("isKeyword",function(base){
			return function(str){
				if (str==="async") {
					this.potentialArrowAt = this.start+str.length+1 ;
					return true ;
				}
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
					es7check(prop) ;
					prop.async = true ;
					key = base.apply(this,arguments) ;
				}
				return key;
			};
		}) ;
	}
}
