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

function aClass() {}

function top() {
	function createA() {
		return aClass() ;
	}
	var x = createA() ;
}

module.exports = async function() {
	top() ;
	return await test()=="k" ;
}
