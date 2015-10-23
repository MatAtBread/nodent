async function runTests(f) {
	try {
		if (f) {
			n += 1 ;
			await breathe(2) ;
			n += 3 ;
		} else {
			n += 2 ;
			await breathe(3) ;
			n += 4 ;
		}
	} catch (ex) {
		console.log(ex) ;
	}
	return n ;
}

var n ;
module.exports = async function(){
	n = "" ;
	return await runTests(1)+await runTests(0) == "131324" ;
}
