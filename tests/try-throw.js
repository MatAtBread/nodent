async function oops() {
	await breathe() ;
	throw "oops" ;
}

async function test() {
	try {
		for (var n=0; n<4; n++) {
			try {
				await oops() ;
			} catch (ex) {
				if (n>2)
					throw "inner" ;
			}
		}
	} catch (ex) {
		throw ex+"-outer" ;
	}
	return ;
}

module.exports = async function() {
	try {
		await test();
	} catch (ex) {
		if (ex==="inner-outer")
			return true ;
	}
	return false ;
}
