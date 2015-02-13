/*
 * Nodent v0.1.x support for '<<=' operator. Deprecated as of v1.x.x in favour of ES7 support
 */

/**
 * Uglify transormer: Transform
 * 
 	x <<= y ;
 	body ;
 *
 * to
 * 
	return y(f(x){ body },bind(this),$error) ; 
 *
 */

module.exports = function(U2,config) {
	console.warn("Nodent ES5 Syntax is deprecated - replace with ES7 async and await keywords") ;
	var asyncAssignTransfom = new U2.TreeTransformer(function(node, descend){
		var isSimple = (node  instanceof U2.AST_SimpleStatement) ;
		var stmt = isSimple?node.body:node ;
	
		var assignee = stmt[config.ltor?"left":"right"] ; 
		var asyncCall = stmt[!config.ltor?"left":"right"] ;
	
		if (stmt instanceof U2.AST_Binary && stmt.operator==config.assign) {
			// Check LHS is an assignable identifier and RHS is a function call 
			if (!(assignee instanceof U2.AST_SymbolRef))
				throw new Error("Assignee of "+config.assign+" async operator must be an identifier") ;
	
			var undefinedReturn = assignee.name=="undefined" ;
	
			var block = asyncAssignTransfom.find_parent(U2.AST_Block) ;
			var i = block.body.indexOf(isSimple?node:asyncAssignTransfom.parent()) ;
			var callBack = block.body.splice(i,block.body.length-i).slice(1) ;
			// Wrap the callback statement(s) in a Block and transform them
			var cbBody = new U2.AST_BlockStatement({body:callBack.map(function(e){return e.clone();})}).transform(asyncAssignTransfom) ;
			var replace = new U2.AST_SimpleStatement({
				body:new U2.AST_Return({
					value:new U2.AST_Call({
						expression:asyncCall.transform(asyncAssignTransfom),
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
			return replace ;
		} else {
			descend(node, this);
			return node ;
		}
	}) ;
	return asyncAssignTransfom ;
}
