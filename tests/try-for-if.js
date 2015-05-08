async function test() {
	var res = "" ;
	async function progress(x) {
		res += "x"+x ;
		res += "p"+phase ;
		sleep(1) ;
		return ;
	}
	
	async function load() {
		return {
			afn:async function() { 
				await progress(2) ;
				return ;
			} 
		} ;
	}

	var phase ;
	try {
		for (var i=0; i<3; i++) {
			phase = "1" ;
			await progress(1) ;
		}

		phase = "2" ;
		await (await load()).afn() ;

		// Check ES
		phase = "3" ;
		await progress(3) ;

		// Check WPS
		if (true) {
			phase = "4" ;
			for (i=0; i<[1].length; i++) {
				if (true) {
					await progress(4) ;
					break ;
				}
			}
		}
	} catch (ex) {
		ex.phase = phase ;
		throw ex ;
	}
	return res ;
} ;

module.exports = async function() {
	return await test()=="x1p1x1p1x1p1x2p2x3p3x4p4" ;
}
