async function test(doThrow) {
	var s = "" ;
	try {
		await sleep(10) ;
		s = "A" ;
		await sleep(20) ;
		s = "B" ;
		if (doThrow) {
			JSON.parse("*");
		}
		await sleep(30) ;
		s = "C" ;
	} catch (ex) {
		return "X" ;
	}
	return s ;
}

module.exports = async function() {
	return await test(true)+await test(false)=="XC" ;
}
