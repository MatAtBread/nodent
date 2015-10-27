async function test() {
	var x = {
		trace:"",
		init:function(n,m) {
			this.n = n ;
			this.m = m ;
		},
		x:async function() {
			this.trace += "x" ;
			return this.n ; 
		},
		y:async function() {
			this.trace += "y" ;
			return this.m ; 
		},
		and:async function() {
			return await this.x() && await this.y() ;
		},
		or:async function() {
			return await this.x() || await this.y() ;
		}
	};

	x.init(0,0) ;
	await x.and() ;
	await x.or() ;
	x.init(0,1) ;
	await x.and() ;
	await x.or() ;
	x.init(1,0) ;
	await x.and() ;
	await x.or() ;
	x.init(1,1) ;
	await x.and() ;
	await x.or() ;
	return x.trace == "xxyxxyxyxxyx" ;
}

module.exports = test;