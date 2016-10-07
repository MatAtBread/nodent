var gen = [
	require('./codegen/cg-es7.js'),
    require('./codegen/cg-promises.js')
];

async function inter(i,j) {
	return (gen[j].name == await gen[j].call() && await gen[j].call() == await gen[i].consume(gen[j].call))?1:100 ;
}

async function test() {
    for (var q=0; q<gen.length*gen.length*2; q++) {
        if (!q%gen.length)
            await breathe() ;
        await inter(q%gen.length,(q/gen.length)%gen.length|0) ;
    }
        
    var a = [inter(0,0),inter(0,1),inter(1,0),inter(1,1)] ;
    
    var multi = await a[0]+await a[0]+await a[1]+await a[1]+await a[2]+await a[2]+await a[3]+await a[3] ;
	var single = (await inter(0,0) +
		await inter(0,1) +
		await inter(1,0) +
		await inter(1,1)) ;

	return single===4 && multi===8  ;
}

module.exports = test ;
