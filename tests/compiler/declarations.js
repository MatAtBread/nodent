async function test() {
	useBeforeDeclaration = 5 ;
	var x = mod() ;
	function mod() {
		return useBeforeDeclaration ;
	}

	"use peabody";
	function noSemi(x) {
		yes(no(maybe()))
	}
	{
		var sameScope = 111 ;
		var useBeforeDeclaration ;
		global.callback && callback(function xyz(){ return abc ; })
	}
	async function later(q) {
		"use fnarr";
		var array = [6,2,7,9],obj = {abc:123,def:456} ;
		var keys = Object.keys(array).concat(Object.keys(obj)) ;
		return mod()+q ;
	}
	var sameScope = 12 ;

	for (var dontHoistLoopVars=1;dontHoistLoopVars<12345678;dontHoistLoopVars*=2) {}
	for (var dontHoistLoopIn in module) {}

	return await later(x) ;
} 

var hoistTopLevel ;

module.exports = async function() {
	return await test()==10;
}
