"use nodent-es7";

async function inc(x) {
	return x+1 ;
};

async function test() {
	var s = "" ;
	var i = 0 ;
	do {
		s += "<"+i ;
		i = await inc(i) ;
		s += ">" ;
	}
	while (i<5) ;
	s += "ok" ;
	return s ;
}

module.exports = async function() {
	return await test() == "<0><1><2><3><4>ok";
}
