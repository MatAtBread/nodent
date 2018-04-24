async function append(a,b) {
	return ""+a+b;
}

async function finalIf(x) {
	if (x)
		await append(x,0) ;
	return ;
}

async function test(x) {
	await finalIf(x) ;
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
	var s = await test(1)+await test(0)+await test(10);	
	return s == "1 is Odd.0 is Zero and Even.10 is Even.";
}
