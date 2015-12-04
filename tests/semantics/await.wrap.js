if (!__nodent.wrapAwait)
	module.exports = async function() { return false ;}
else {
	async function inc(x) { return x+1 ; } 

	async function test() {
		var a = await inc(999) ;
		var b = await 1000 ;
		var c = await 999+1 ;
		return a==b && b==c;
	}
	module.exports = test ;
}
