/* noDentify is an old routine attaached to Function.prototype in nodent <=v2.6.10
 * It is included here if users of >v3.0.0 really want it
 */
 
module.exports = function(nodent,config) {
/**
 * NoDentify (make async) a general function.
 * The format is function(a,b,cb,d,e,f){}.noDentify(cbIdx,errorIdx,resultIdx) ;
 * for example:
 * 		http.aGet = http.get.noDentify(1) ;	// The 1st argument (from zero) is the callback. errorIdx is undefined (no error)
 *
 * The function is transformed from:
 * 		http.get(opts,function(result){}) ;
 * to:
 * 		http.aGet(opts).then(function(result){}) ;
 *
 * @params
 * idx			The argument index that is the 'callback'. 'undefined' for the final parameter
 * errorIdx		The argument index of the callback that holds the error. 'undefined' for no error value
 * resultIdx 	The argument index of the callback that holds the result.
 * 				'undefined' for the argument after the errorIdx (errorIdx != undefined)
 * 				[] returns all the arguments
 * promiseProvider	For promises, set this to the module providing Promises.
 */
	return function noDentify(idx,errorIdx,resultIdx,promiseProvider) {
		promiseProvider = promiseProvider || nodent.Thenable ;
		var fn = this ;
		return function() {
			var scope = this ;
			var args = Array.prototype.slice.apply(arguments) ;
			var resolver = function(ok,error) {
				if (undefined==idx)	// No index specified - use the final (unspecified) parameter
					idx = args.length ;
				if (undefined==errorIdx)	// No error parameter in the callback - just pass to ok()
					args[idx] = ok ;
				else {
					args[idx] = function() {
						var err = arguments[errorIdx] ;
						if (err)
							return error(err) ;
						if (Array.isArray(resultIdx) && resultIdx.length===0)
							return ok(arguments) ;
						var result = arguments[resultIdx===undefined?errorIdx+1:resultIdx] ;
						return ok(result) ;
					} ;
				}
				return fn.apply(scope,args) ;
			}
			return new promiseProvider(resolver) ;
		};
	}
}
