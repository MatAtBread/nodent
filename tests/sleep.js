async function test(doThrow) {
	var s = "" ;
	try {
		await sleep(50) ;
		s = "A" ;
		await sleep(60) ;
		s = "B" ;
		if (doThrow) {
			JSON.parse("*");
		}
		await sleep(70) ;
		s = "C" ;
	} catch (ex) {
		return "X" ;
	}
	return s ;
}

module.exports = async function() {
	return await test(true)+await test(false)=="XC" ;
}
