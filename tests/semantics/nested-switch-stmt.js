async function inc(y) { return y+1 }

async function test(x,z) {
	var y;
	switch (x) {
	case 1:
		y = await inc(x) ;
		break ;
	case 10:
		y = await inc(-x) ;
		switch (z) {
		case 1:
			y = await inc(1) ;
			break ;
		case 2:
			return y = await inc(100) ;
		default:
		case 3:
			break ;
		}
		return y*5 ;
	default:
		y = x ;
		break ;
	}
	y = y*10 ;
	return y ;
};

module.exports = async function() {
	var x = await test(1)+await test(5)+await test(10,1)+await test(10,2)+await test(10,3) ;
	return  x == 136 ;
}

