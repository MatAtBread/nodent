"use strict";

class X {
	constructor() {
		this.trace = "" ;
	}
	init(n,m) {
		this.n = n ;
		this.m = m ;
	}
	async x() {
		this.trace += "x" ;
		return this.n ; 
	}
	async y() {
		this.trace += "y" ;
		return this.m ; 
	}
	async and() {
		return await this.x() && await this.y() ;
	}
	async or() {
		return await this.x() || await this.y() ;
	}
}

async function test() {
	var x = new X() ;
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