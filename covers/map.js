function MapError(message) {
  Error.apply(this,arguments) ;
  this.name = 'MapError';
}
MapError.prototype = Object.create(Error.prototype);
MapError.prototype.constructor = MapError;

module.exports = function(nodent,opts) {
    if (!opts) opts = {} ;
    if (!opts.Promise)
        opts.Promise = global.Promise || nodent.Thenable ;

	function map(what,result,asyncFn) {
		var hasError = false ;
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
		var context = new MapError() ;
		if (!asyncFn && (typeof result in {'function':true,'undefined':true})) {
			asyncFn = result ;
			result = isArray?[]:{} ;
		}
		var array = isArray?what:Object.keys(what) ;
		return new (opts.Promise)(function ($return,$error) {
			var len = array.length ;
			if (len==0)
				return $return(result) ;

			array.forEach(function(e,i,ar){
				function complete(r) {
					if (r instanceof Object && typeof r.then==="function")
						return r.then(complete,completeError) ;
					
					var k = isArray?i:e ; 
					if (k in result) {
						context.message = "nodent.map: multiple $returns/errors at "+k ; 
						return $error(context) ;
					}
					result[k] = r ;
					len -= 1 ;
					if (len==0) {
						if (hasError) {
							context.message = Object.keys(hasError).map(function(e){ return e+": "+hasError[e].message }).join(", ");	
							context.results = result ;
							return $error(context) ;
						}
						return $return(result) ;
					}
					else if (len<0) {
						context.message = "nodent.map: Excess $returns/errors at "+k ;
						return $error(context) ;
					}
				} ;
				function completeError(x) {
					if (!(x instanceof Error))
						x = new Error(x) ;
					if (opts.throwOnError) {
						hasError = hasError || {} ;
						hasError[isArray?i:e] = x ;
					}
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
	}
	map.MapError = MapError ;
	return map ;
}

module.exports.MapError = MapError ;

