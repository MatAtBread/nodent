"use nodent-es7";

console.log(arguments.callee.toString()) ;

async function maybe(x) {
	if (x) throw x ;
	JSON.parse("*") ;
	return x ;
}

async function test(x) {
	console.log("step 1") ;
	try {
		await maybe(x) ;
		console.log("try 2") ;
	} catch (ex) {
		console.log("ex 3",ex) ;
	}
	console.log("step 4") ;
}

debugger ;

await test(0) ;