// Return an async function asynchronously
async function x() {
	setImmediate(function(){
		async return async function xy() { return 2 }
	}) ;
}

//Return a sync function asynchronously
async function z() {
	setImmediate(function(){
		async return function ab() { return 3 } ;
	}) ;
}

//Return an async function synchronously
function w() {
	return async function() { return  5 }
}

//Return an sync function asynchronously
async function y() {
	return function() { return 7 }
}

//Return an async function asynchronously
async function v() {
	return async function() { return 11 }
}

module.exports = async function() {
	var r = await w()() ;
	r *= await (await x())() ;
	r *= (await z())() ;
	r *= (await y())() ;
	r *= await (await v())() ;
	return r==210*11 ;
}

