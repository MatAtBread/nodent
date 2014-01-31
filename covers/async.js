module.exports = function(nodent) {
	return {
		map:function(what,result,async) {
			var isArray = Array.isArray(what) ;
			var context = new Error() ;
			if (!async && typeof result==='function') {
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
					async.apply(this,arguments)(complete,completeError);
				}) ;
			};
		}
	};
}
