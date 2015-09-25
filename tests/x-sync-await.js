// Test using 'await' in a sync function
async function neg(x) {
	return -x ;
}

var syncReturnValue = {abc:123} ;
var waited = false ;
function sync(y) {
	waited = await neg(y)==-y ;
	return syncReturnValue ;
}

module.exports = async function() {
	syncReturnValue = {abc:123} ;
	waited = false ;
	var r = sync(10);
	var thenable = ((r instanceof Object) && (typeof r.then === "function")) ;
	setTimeout(function(){
		// NB: For full Promise implementations, the sync-return "r" will
		// be a Promise, with a '.then()' member. For nodent.Thenables or
		// funcbacks, the expected return is the return from the function,
		// whatever type that is. This test passes BOTH cases as expected.
		
		// The difference in this behaviour is intended, but less than ideal
		// as it requires an async function defined by nodent to be assimilated
		// by a full Promise library - the nodent.Thenable interface is
		// NOT a Promise, and you can't say .then().then().then().

		// The advantage (dubious) is that you can return any synchronous value,
		// including a Promise (or Thenable) if you wish, or an object with additional
		// methods to (for example) abandon the Promise/Thenable.
		
		return async (waited && (thenable?true:r===syncReturnValue)) ;
	},0) ;
}
