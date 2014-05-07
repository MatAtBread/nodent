function map(what,result,async) {
	if (typeof what=="number") {
		var period = [] ;
		period.length = Math.floor(what) ;
		period.forEach = function(fn) {
			for (var i=0; i<period.length; i++)
				fn.apply(null,[i,i,period]) ;
		} ;
		return map(period,result,async) ;
	}

	var isArray = Array.isArray(what) ;
	var context = new Error() ;
	if (!async && (typeof result in {'function':true,'undefined':true})) {
		async = result ;
		result = isArray?[]:{} ;
	}
	var array = isArray?what:Object.keys(what) ;
	return function ($return,$error) {
		var len = array.length ;
		if (len==0)
			return $return(result) ;

		array.forEach(function(e,i,ar){
			function complete(r) {
				var k = isArray?i:e ; 
				if (k in result) {
					context.message = "mapAsync: multiple $returns/errors"+k.toString ; 
					$error(context) ;
					return ;
				}
				result[k] = r ;
				len -= 1 ;
				if (len==0)
					return $return(result) ;
				else if (len<0) {
					context.message = "mapAsync: Excess $returns/errors"+k.toString() ;
					$error(context) ;
					return ;
				}
			} ;
			function completeError(x) {
				if (x instanceof Error)
					complete(x) ;
				else
					complete(new Error(x)) ;
			}
			
			(async || (isArray?e:what[e])).apply(this,arguments)(complete,completeError);
		}) ;
	};
}

module.exports = function(nodent) {
	return {
		map:map
	} ;
}
