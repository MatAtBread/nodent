"use nodent-promise";

global.Promise = require('../nodent')().Promise ;
console.log(arguments.callee.toString()) ;

async function add(a,b) { return a+b }  
async function test(){
	var y = await add(await add(6,4),await add(3,7)) ;
	return y ;
}
console.log(await test()) ;