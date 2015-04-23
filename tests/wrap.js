async function abc(x) {
	if (x) {
		throw "def" ;
	}
	return "abc" ;
};

async function test1(x) {
	return abc(x) ;
}

var tests = [
    test1,
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
		for (var j=0; j<2; j++) {
			try {
				var k = await tests[i](j) ;
				if (k==="abc")
					passes += 1 ;
			} catch(ex) {
				if (ex==="def")
					passes += 1 ;
			}
		}
		
	}
	return passes==tests.length*2  ;
}

var map = require('../nodent')().require('map') ;
async function wrapMap() {
	var fns = tests.map(function(f){ return f()}) ;
	var m = await map(fns.concat(['abc'])) ;
	return m.every(function(x){return x==="abc"}) ;
}

async function runTests() {
	return (await go() & await wrapMap())==true ;
}

module.exports = runTests ;