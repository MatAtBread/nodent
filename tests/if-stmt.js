"use nodent-promise";
Promise = require('../nodent')().Promise ;

console.log(arguments.callee.toString()) ;

async function test(x) {
	var r = "" ;
	if (!x) {
		r = "Zero and " ;
	} 

	var z ;
	if (x&1) {
		r += "Odd" ;
	} else {
		r += "Even" ;
	}
	z = x+" is "+r+"." ;
	return z ;
};

console.log(await test(1),await test(0),await test(10))
