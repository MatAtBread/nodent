"use nodent-promise";
Promise = require('../nodent')().Promise ;

//console.log(arguments.callee.toString()) ;

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

module.exports = async function() {
	var s = await test(1)+await test(0)+await test(10);	
	return s == "1 is Odd.0 is Zero and Even.10 is Even.";
}
