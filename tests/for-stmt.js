"use nodent-es7";

var $error = function(ex) {
	console.error("Ooops!",ex?ex.message:ex) ;
	process.exit(-1) ;
}
console.log(arguments.callee.toString()) ;
async function fn(n) { await setImmediate ; console.log(n); return n+1 };

// NB: Nodent 1.0.17 does not handle return inside a loop correctly
// Solution: capture the function's $return, and map `return` inside a loop
// to `void <captured-return>(<expr>)
async function testNest() {
	var $exit_for_i$1 = $return ;
	console.log("<nest");
	for (var i=1;i<10;i++) {
		console.log("<i",i);
		for (var j=1;j<10;j++) {
			if (await fn(i*j) > 20) {
				return void $exit_for_i$1("returned");
//				break ;
			}
		}
		console.log("i>",i);
	}
	console.log("nest>");
	return ;
}
async function testReturn() {
	var $exit_for_i$2 = $return ;
	console.log("<return");
	for (var i=0;i<10;i++) {
		if (await fn(i) > 3) {
			return void $exit_for_i$2() ;
		}
	}
	console.log("return>");
	return ;
}
async function testBreak() {
	console.log("<break");
	for (var i=0;i<10;i++) {
		if (await fn(i) > 3) {
			break ;
		}
	}
	console.log("break>");
	return ;
}
debugger;
await testNest() ;
await testReturn() ;
await testBreak() ;
