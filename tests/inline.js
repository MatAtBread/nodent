async function test() {
	if (cond1) {
		await fn1() ;
		if (cond2) {
			await fn2() ;
		}
	}
	someMore() ;
	done() ;
}

module.exports = async function() {
	return true ;
}