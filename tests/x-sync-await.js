// Test using 'await' in a sync function
async function neg(x) {
	return -x ;
}

var syncReturnValue = {abc:123} ;
var waited ;
function sync(y) {
	waited = await neg(y)==-y ;
	return syncReturnValue ;
}

module.exports = async function() {
	waited = false ;
	var r = sync(10);
	setTimeout(function(){
		// Although 'waited' is always true (if the test is good),
		// the value of 'r' is compilation/Promise specific: only
		// -es7 and nodent.Thenables() pass the value back
		// unmolested, whereas Promises (and therefore generators)
		// return a Promise of the value of neg(y), since that's
		// the first await in 'sync()'
		return async (waited && r===syncReturnValue) ;
	},1) ;
}
