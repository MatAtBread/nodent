async function inc(x) {
	return x+1 ;
};

async function test() {
	var s = "" ;
	for (var i=0; i<10; i++) {
		if (i*i >= 30) {
			s += "break"+i+" " ;
			break ;
		}
		if (i*i >= 9) {
			s += "big"+i+" " ;
			continue ;
		}
		s += await inc(i)+"-"+i*i+" " ;
	}

	for (i=0; i<10; i++) {
		if (i >= 5) {
			return s+"ret" ;
		}
		s += await inc(i)+"-"+i*i+" " ;
	}
	s += "ok" ;
	return s ;
}

module.exports = async function() {
	return await test()=="1-0 2-1 3-4 big3 big4 big5 break6 1-0 2-1 3-4 4-9 5-16 ret" ;
}
