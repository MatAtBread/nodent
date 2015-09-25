var gen = [
	require('./codegen/cg-es7.js'),
	require('./codegen/cg-promises.js')
];

async function inter(i,j) {
	return (gen[j].name == await gen[j].call() && await gen[j].call() == await gen[i].consume(gen[j].call))?1:100 ;
}

async function test() {
	return (await inter(0,0) +
		await inter(0,1) +
		await inter(1,0) +
		await inter(1,1)) == 4 ;
}

module.exports = test ;
