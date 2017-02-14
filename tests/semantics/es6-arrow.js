

var q = [
	 async x => 3,
	 async () => 3,
	 async (x) => 3,
	 async (x,y,z) => 3,
	 async x => { return 3 },
	 async () => { return 3 },
	 async (x) => { return 3 },
	 async (x,y,z) => { return 3 }
];         

var r = {
	a:async x => x*10
};

module.exports = async () => {
	var t = 0 ;
	for (var i=0; i<q.length; i++)
		t += await q[i]() ;
	return t+await r.a(2)==q.length * 3+20 ;
};
