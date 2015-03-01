async function add(a,b) {
	async function log(x) {
		return x ;
	}
	await log(a+b) ;
	return a+b ;
}  

module.exports = async function() {
	return await add(123,456)==579 ;
}
