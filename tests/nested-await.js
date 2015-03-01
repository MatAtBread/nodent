async function add(a,b) { 
	return a+b 
}

async function test(){
	return await add(await add(6,4),await add(3,7)) ;
}

module.exports = async function() {
	return await test()==20 ;
}
