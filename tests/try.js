"use nodent-promise";

//s += (arguments.callee.toString()) ;

async function wait(){
	setImmediate(function(){
		try{
			$return();
		} catch(ex){ 
			$error(ex) 
		}}) ;
} 

async function maybe(x) {
	await wait() ;
	if (x>2) {
		JSON.parse("*") ;
		return -1 ;
	}
	else
		return x ;
}

async function test(x) {
	var s = "" ;
	for (var n=0; n<x; n++) {
		s += ("<") ;
		try {
			s += ("B") ;
			await maybe(n) ;
			s += ("C") ;
		} catch (ex) {
			s += ("X") ;
		}
		s += ("> ") ;
	}
	return s ;
}

module.exports = async function() {
	return await test(5) == "<BC> <BC> <BC> <BX> <BX> ";
}

