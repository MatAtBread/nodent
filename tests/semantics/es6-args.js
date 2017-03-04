

async function a() {
	return arguments[0] ;
}

var b = async function() {
	return arguments[1] ;
} ;

var c = {
	a:async function() {
		return arguments[2] ;
	},
	async b() {
		return arguments[3] ;
	}
} ;

var q = class {
	async a() {
		return arguments[4] ;
	}
};

class Q {
	async b() {
		return arguments[5] ;
	}
}

async function test1() {
	var args = "the quick brown fox jumps over".split(" ") ;
	var r = [await a.apply(null,args),await b.apply(null,args),
	         await c.a.apply(null,args), await c.b.apply(null,args),
	         await new q().a.apply(null,args), await new Q().b.apply(null,args)] ;
	return (r.join(" ")===args.join(" ")) ;
}

async function test2() {
	var foo = async function() {
		var bar1 = async function() { return  arguments[0] } ;
		var bar2 = async () => { return  arguments[0] } ;
		var bar3 = async () => arguments[0] ;

	  return await bar1(arguments[0])===123 && await bar2(arguments[0])===123 && await bar3(arguments[0])===123 ;
	}

	return await foo(123) ;
}

async function test() {
	return await test1() && await test2() ;
}

module.exports = test ;
