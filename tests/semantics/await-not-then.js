// Only run this test if await-wrapping is enabled
if (__nodent.wrapAwait) {
	module.exports = async function() {
		return 'abc' === await 'abc' ;
	} ;
} else {
	module.exports = async function() { return 'n/a' } ;
}
