async function test() {
	j = 5 ;
	var x = mod() ;
	function mod() {
		return j ;
	}
	debugger ;
	"use peabody";
	function noSemi(x) {
		yes(no(maybe()))
	}
	{
		var sameScope = 111 ;
		var j ;
		global.callback && callback(function xyz(){ return abc ; })
	}
	async function later(q) {
		"use fnarr";
		var array = [6,2,7,9],obj = {abc:123,def:456} ;
		var keys = Object.keys(array).concat(Object.keys(obj)) ;
		return mod()+q ;
	}
	var sameScope = 12 ;
	return await later(x) ;
} 

var xxx ;

module.exports = async function() {
	return await test()==10;
}
