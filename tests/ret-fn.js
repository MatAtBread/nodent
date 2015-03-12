
function test() {
	return async function() {
		return "t" ;
	}
}

module.exports = async function() {
	var s = await test()() ;
	return s=="t" ;
}
