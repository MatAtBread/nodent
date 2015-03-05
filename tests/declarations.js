var xxx ;

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
		return mod()+q ;
	}
	return await later(x) ;
} 

module.exports = async function() {
	return await test()==10;
}
