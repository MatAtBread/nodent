async function test() {
	return afterReturn() ;
	return 123 ;
	function afterReturn() {
		{
			var s = "k" ;
			{
				return s ;
			}
		}
		unreachable.code() ;
	}
	thats.all.folks ;
}

module.exports = async function() {
	return await test()=="k" ;
}
