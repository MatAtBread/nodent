async function inc(y) { return y+1 }

async function test(x) {
	var y;
	switch (x) {
	case 1:
		y = await inc(x) ;
		break ;
	case 10:
		y = await inc(-x) ;
		return y*5 ;
	default:
		y = x ;
		break ;
	}
	y = y*10 ;
	return y ;
};

module.exports = async function() {
	var x = await test(1)+await test(5)+await test(10) ;
	return  x == 25 ;
}

