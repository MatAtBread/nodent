async function sleep(t){
	setTimeout($return,t) ;
} 

async function test(doThrow) {
	var s = "" ;
	try {
		await sleep(100) ;
		s = "A" ;
		await sleep(120) ;
		s = "B" ;
		if (doThrow) {
			JSON.parse("*");
		}
		await sleep(150) ;
		s = "C" ;
	} catch (ex) {
		return "X" ;
	}
	return s ;
}

module.exports = async function() {
	return await test(true)+await test(false)=="XC" ;
}
