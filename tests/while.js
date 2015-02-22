"use nodent-promise";

Promise = require('../nodent')().Promise ;

async function inc(x) {
	setTimeout($return.bind(null,x+1),100) ;
};

async function test() {
	var s = "" ;
	var i = 0 ;
	while (i<5) {
		s += "<" ;
		i = await inc(i) ;
		s += i ;
		s += ">" ;
	}
	s += ("ok") ;
	return s ;
}

module.exports = async function() {
	return await test()=="<1><2><3><4><5>ok" ;
}

