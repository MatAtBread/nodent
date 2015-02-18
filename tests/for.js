"use nodent-promise";
Promise = require('../nodent')().Promise ;

Promise = require('../nodent')().Promise ;
console.log(arguments.callee.toString()) ;

async function inc(x) {
	setTimeout($return.bind(null,x+1),300) ;
};

function test() {
	for (var i=0; i<5; i++) {
		if (i*i >= 9) {
			console.log("big",i) ;
			continue ;
		}
		console.log(await inc(i),i*i) ;
	}
	console.log("ok") ;
}

test() ;