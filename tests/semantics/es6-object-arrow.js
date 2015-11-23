var res ;

async function y(a) { return res = res+a }

var obj = {
		e: async function(a) { return await y(a) },
		f:async (a)=>await y(a),
		async g(a) { return await y(a) },
		h:async (a)=>{return await y(a)}
	};

var sync = {
		e: function(a) { return await y(a) },
		f: (a)=>await y(a),
		g(a) { return await y(a) },
		h: (a)=>{return await y(a)}
	};

async function test(){
	res = "" ;
	await obj.e(1) ;
	await obj.f(2) ;
	await obj.g(3) ;
	await obj.h(4) ;

	sync.e(5) ;
	sync.f(6) ;
	sync.g(7) ;
	sync.h(8) ;
	setImmediate(function(){
		async return res == "12345678" ;
	}) ;
}

module.exports = test ;
