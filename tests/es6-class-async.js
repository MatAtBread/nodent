"use strict";

class One {
	constructor(init) {
		this.n = [] ;
		this.n.push("A")
		this.xyz = init ;
	}
	async name(r) {
		return r*this.xyz ;
	}
	sname(r) {
		return r*this.xyz ;
	}
}

class Two extends One {
	constructor(init) {
		super(init) ;
		this.n.push("B") ;
	}
	async name(r) {
		return await super.name(r)+1 ;
	}
	sname(r) {
		return super.sname(r)+1 ;
	}
} ;

class Three extends Two {
	constructor(init) {
		super(init) ;
		this.n.push("C") ;
	}
	async name(r) {
		/*NB: Doesn't work with generators as yield must execute in the function body, not a nested function
		setImmediate(function(){
			return async (await super.name(r)*4) ; 
		}.bind(this));*/
		
		/* Works with generators as well as -es7 & Promises */
		return await super.name(r)*4 ;
	}
	sname(r) {
		return super.sname(r)*4 ;
	}
} ;

class Four extends Three {
	constructor() {
		super(100) ;
		this.n.push("D") ;
	}
	async name(r) {
		return this.n.join("")+await super.name(r) ; 
	}
	sname(r) {
		return this.n.join("")+super.sname(r) ; 
	}
} ;

module.exports = async function() {
	let x = new Four() ;
	return x.sname(3)==await x.name(3) && x.sname(3)=="ABCD1204" ;
}
