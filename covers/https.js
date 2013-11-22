
/**
 * Entirely optional: create an instance of noDent friendly
 * http with the API:
 * 		res <<== nodent.http.get(opts) ;
 * 			... set up some stuff with res...
 * 		undefined <<= res.wait('end') ;
 */

module.exports = function(nodent) {
	var http = require('http') ;

	return {
		get:function(opts){
			return function($return,$error){
				http.get(opts,function(response){
					response.wait = onIncomingMessageEnd ;
					$return(response);
				}).on('error',$error) ;
			}
		}	
	};
};

function onIncomingMessageEnd(event) {
	var ee = this ;
	return function($return,$error) {
		ee.once(event,$return) ;
		ee.once('error',$error) ;
	}
}

