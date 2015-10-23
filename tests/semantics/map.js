var nodent = require('../nodent')();
var map = nodent.require('map') ;
var mapex = nodent.require('map',{throwOnError:true}) ;

async function mapper(i) {
	if (i)
		return i*2 ;
	throw i+" too small" ;
}

async function test() {
	var x,y ;
	try {
		x = await map(2,mapper) ;
		y = await mapex(2,mapper) ;
	} catch (ex) {
		return x[0] instanceof Error && !(x[1] instanceof Error) && ex.results.length==2 ;
	}
	return false ;
}

module.exports = test ;
