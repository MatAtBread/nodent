"use nodent-es7";

function test() {
	return async function x() {
		return "t" ;
	}
}

function test2() {
	return async function() {
		return "u" ;
	}
}

function test3() {
	return function x() {
		return "t" ;
	}
}

function test4() {
	return function() {
		return "u" ;
	}
}

function loop() {
	var a = [] ;
	for (var x=0; i<3; x++) {
		a.push(function named(){
			return x ;
		}) ;
	}
}
function assignment() {
	var a = function() { return "a" } ;
	var b = function fb() { return "b" } ;
	var c = async function() { return "c" } ;
	var d = async function fd() { return "d" } ;
	a = function() { return "za" } ;
	b = function fb2() { return "zb" } ;
	c = async function() { return "zc" } ;
	d = async function fd2() { return "zd" } ;
	function hoistable() {
		
	}
}

console.log(await (async function() {
	var s = await test()() ;
	return s=="t" ;
})()) ;
