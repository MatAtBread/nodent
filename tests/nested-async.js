"use nodent-promise";
Promise = require('../nodent')().Promise ;

console.log(arguments.callee.toString()) ;

async function add(a,b) {
	async function log(x) {
		console.log(x) ;
		return x ;
	}
	await log(a+b) ;
	return a+b ;
}  

await add(123,456) ;