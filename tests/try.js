"use nodent-es7";

console.log(arguments.callee.toString()) ;

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
	for (var n=0; n<5; n++) {
		console.log("step 1") ;
		try {
			console.log(n,"try 2a") ;
			await maybe(n) ;
			console.log(n,"try 2b") ;
		} catch (ex) {
			console.log(n,"ex 3",ex) ;
		}
		console.log(n,"step 4") ;
	}
}

debugger ;

await test(0) ;