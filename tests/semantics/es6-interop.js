var gen = [
	require('./codegen/cg-es7.js'),
	require('./codegen/cg-promises.js'),
	require('./codegen/cg-generators.js')
];

function* gen(){}

async function inter(i,j) {
	return (gen[j].name == await gen[j].call() && await gen[j].call() == await gen[i].consume(gen[j].call))?1:100 ;
}

async function test() {
	var single = (await inter(0,1) +
		await inter(0,2) +
		await inter(1,0) +
		await inter(1,2) +
		await inter(2,0) +
		await inter(2,1)) ;
	
	var a = [inter(0,1),
	        inter(0,2),
	        inter(1,0),
	        inter(1,2),
	        inter(2,0),
	        inter(2,1)] ;
	
	var multi = 0 ;
	for (var i=0; i<a.length; i++)
	    multi += await a[i]+await a[i] ;
	return single===6 && multi===12 ;
}

module.exports = test ;
