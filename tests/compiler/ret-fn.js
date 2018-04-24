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
	for (var x=0; x<3; x++) {
		a.push(function named(){
			return x ;
		}) ;
	}
	return a.map(function(f){ return f.call()}).join(".") ;
}

async function assignment() {
	var a = function() { return "a" } ;
	var b = function fb() { return "b" } ;
	var c = async function() { return "c" } ;
	var d = async function fd() { return "d" } ;
	function hoistable() {}
	function twoOfMe() {}
	a = function() { return "za" } ;
	b = function fb2() { return "zb" } ;
	c = async function() { return "zc" } ;
	d = async function fd2() { 
		return "zd" 
		function hoistable() {}
	} ;
	function twoOfMe() {}
	return await d()+a()+await c()+b() ;
}

module.exports = async function() {
	var s = (await test()())+(await test2()())+(test3()())+test4()()+loop()+await assignment();
	return s == "tutu3.3.3zdzazczb";
} ;
