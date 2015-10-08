/* Syntax checks - just make sure it all compiles */
module.exports = async function() {
	return true ;
}

function syntax() { 
	var async, await ;

//	Nested await
	async function test() {
		return await (await a()).b() ;
	}

//	is just an ExpressionStatement followed by a FunctionDeclaration.
	async
	function sfoo() {}

// i am an expression not a declaration
	(async function efoo() {}); 

	async function afoo () {}
	(afoo)

//	syntax checks
	await x + await y;
	await x(1,await y,await(x)) ;
	await(y) ;
	await (z) ;
	async = f('z') ;
	async.toString() ;
	async = async function z(){} ;
	async(x) ;
	var q = async(z) ;

	var sleep = async function sleep() {
		(function (){
			async return 0 ;
		})() ;
	}
	var c = {
			a:async function() {
				return arguments[2] ;
			},
			async x() {
				return y ;
			}
	} ;
}
