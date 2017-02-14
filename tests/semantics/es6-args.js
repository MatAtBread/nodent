

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

async function test() {
	var args = "the quick brown fox jumps over".split(" ") ;
	var r = [await a.apply(null,args),await b.apply(null,args),
	         await c.a.apply(null,args), await c.b.apply(null,args),
	         await new q().a.apply(null,args), await new Q().b.apply(null,args)] ;
	return (r.join(" ")===args.join(" ")) ;
}

module.exports = test ;
