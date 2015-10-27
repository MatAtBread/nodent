async function test() {
	var x = {
		n:0,
		t:true,
		f:false,
		True:async function() {
			this.n += 1 ;
			return this.t ;
		},
		False:async function() {
			this.n += 1 ;
			return this.f ;
		},
		test:async function(f) {
			return this[f]==(this[f]?await this.True() : await this.False()) ;
		}
	} ;	
	return await x.test('t') && await x.test('f') && x.n==2 ;
}

module.exports = test ;