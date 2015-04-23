async function abc(x) {
	if (x) {
		throw "def" ;
	}
	return "abc" ;
};

var tests = [
	async function test1(x) {
		return abc(x) ;
	},
	async function(x) {
		return await abc(x) ;
	},
	async function(x) {
		return test1(x) ;
	},
	function(x) {
		return abc(x) ;
	},
	function(x) {
		return test1(x) ;
	}
];

async function go() {
	var passes = 0 ;
	for (var i=0; i<tests.length; i++) {
		if (await tests[i]()==="abc")
			passes += 1 ;
	}
	for (var i=0; i<tests.length; i++) {
		try {
			await tests[i](1) ;
		} catch(ex) {
			if (ex==="def")
				passes += 1 ;
		}
	}
	return passes==tests.length*2  ;
}

var map = require('../nodent')().require('map') ;
async function wrapMap() {
	var m = await map(tests.map(function(f){ return f()}).concat(['abc'])) ;
//	console.log(m) ;
	return m.every(function(x){return x==="abc"}) ;
}

module.exports = async function() {
	return (await go() & await wrapMap()) == true ;
}