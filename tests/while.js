"use nodent-promise";

Promise = require('../nodent')().Promise ;
console.log(arguments.callee.toString()) ;

async function inc(x) {
	setTimeout($return.bind(null,x+1),300) ;
};

function test() {
	var i = 0 ;
	while (i<5) {
		console.log("<",i)
		i = await inc(i) ;
		console.log(">",i)
	}
	console.log("ok") ;
}

test() ;