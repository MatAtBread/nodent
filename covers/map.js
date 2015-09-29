module.exports = function(nodent,opts) {
	opts = opts || {} ;
	return new nodent.Thenable(function map(what,result,asyncFn) {
		var hasError = null ;
		if (typeof what=="number") {
			var period = [] ;
			period.length = Math.floor(what) ;
			period.forEach = function(fn) {
				for (var i=0; i<period.length; i++)
					fn.apply(null,[i,i,period]) ;
			} ;
			return map(period,result,asyncFn) ;
		}

		var isArray = Array.isArray(what) ;
		var context = new Error() ;
		if (!asyncFn && (typeof result in {'function':true,'undefined':true})) {
			asyncFn = result ;
			result = isArray?[]:{} ;
		}
		var array = isArray?what:Object.keys(what) ;
		return new nodent.Thenable(function ($return,$error) {
			var len = array.length ;
			if (len==0)
				return $return(result) ;

			array.forEach(function(e,i,ar){
				function complete(r) {
					if (r instanceof Object && typeof r.then==="function")
						return r.then(complete,completeError) ;
					
					var k = isArray?i:e ; 
					if (k in result) {
						context.message = "nodent.map: multiple $returns/errors -"+k ; 
						$error(context) ;
						return ;
					}
					result[k] = r ;
					len -= 1 ;
					if (len==0)
						return hasError?$error(hasError):$return(result) ;
					else if (len<0) {
						context.message = "nodent.map: Excess $returns/errors -"+k ;
						$error(context) ;
						return ;
					}
				} ;
				function completeError(x) {
					if (!hasError && opts.throwOnError) {
						hasError = new Error() ;
						hasError.results = result ;
					}
					if (!(x instanceof Error))
						x = new Error(x) ;
					complete(x) ;
				}
				
				if (asyncFn) {
					asyncFn.apply(this,arguments).then(complete,completeError);	
				} else {
					var f = isArray?e:what[e] ; 
					if (nodent.isThenable(f))
						f.then(complete,completeError);
					else 
						complete(f) ;
				}
			}) ;
		});
	}) ;
}
