"use nodent-es7";

// Return an async function asynchronously
async function x() {
	setImmediate(function(){
		return async async function xy() { return 2 }
	}) ;
}

//Return a sync function asynchronously
async function z() {
	setImmediate(function(){
		function ab() { return 3 } ;
		return async ab ;
	}) ;
}

//Return an async function synchronously
async function w() {
	return async function() { return  5 }
}

module.exports = async function() {
	var r = await (await w())() ;
	r *= await (await x())() ;
	r *= (await z())() ;

	return r==30 ;
}

