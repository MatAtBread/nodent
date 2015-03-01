async function append(a,b) {
	return ""+a+b;
}

async function test(x) {
	var r = "" ;
	if (!x) {
		r = "Zero and " ;
	} 

	var z ;
	if (x&1) {
		r = await append(r,"Odd") ;
	} else {
		r += "Even" ;
	}
	z = await append(x," is ") ;
	z = z+r+"." ;
	return z ;
};

module.exports = async function() {
	var map = require('../nodent')({use:['map']}).map ;
	var s = (await map([test(1),test(0),test(10)])).join("") ;
	return s == "1 is Odd.0 is Zero and Even.10 is Even.";
}
