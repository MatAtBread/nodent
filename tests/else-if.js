"use nodent-es7";

async function append(a,b) {
	return ""+a+b;
}

async function test(x) {
	var s ;

	if (x==0) {
		s = await append(x,"zero")
	} else 
		if (x==1) {
			s = await append(x,"one")
		} else { 
			s = await append(x,"?")
		} 

	return s ;
};

module.exports = async function() {
	var s = await test(1)+await test(0)+await test(2);	
	return s=="1one0zero2?";
}

//console.log(await module.exports()) ;
