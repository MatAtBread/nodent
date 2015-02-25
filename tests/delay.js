"use nodent-es7";

console.log(arguments.callee.toString());
async function sleep(t){
	setTimeout(function(){
		try{
			$return();
		} catch(ex){ 
			$error(ex) 
		}},t) ;
} 

async function test(doThrow) {
	var s = "" ;
	try {
		await sleep(200) ;
		s = "A" ;
		await sleep(300) ;
		s = "B" ;
		if (doThrow)
			JSON.parse("*");
		await sleep(400) ;
		s = "C" ;
	} catch (ex) {
		return "X" ;
	}
	return s ;
}

module.exports = async function() {
	return await test(false)+await test(true) ;
}
