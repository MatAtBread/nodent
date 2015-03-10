var s = "" ;
async function fn(f) { s += "."+f ; return }

async function test(a,b) {
	if (a) {
		await fn(a) ;
		if (b) {
			await fn(b) ;
		} else {
			await fn(-a) ;
		}
	} else {
		await fn(-b) ;
	}
	return ;
}

module.exports = async function() {
	await test(0,0)+await test(0,1)+await test(1,0)+await test(1,1) ;
	return s==".0.-1.1.-1.1.1" ;
}