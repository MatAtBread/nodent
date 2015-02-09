
/**
 * Create an instance of noDent friendly http with the API:
 * 		res <<== nodent.http.get(opts) ;
 * 			... set up some stuff with res...
 * 		undefined <<= res.wait('end') ;
 */

module.exports = function(nodent) {
	nodent.require('events') ;
	var http = require('https') ;
	var cover = Object.create(http) ;

	cover.request = function(opts){
		return new nodent.Promise(function($return,$error){
			var request = http.request(opts,function(){}) ;
			request.on('error',$error) ;
			$return(request) ;
		}) ;
	};
	
	cover.get = function(opts){
		return new nodenr.Promise(function($return,$error){
			http.get(opts,$return).on('error',$error) ;
		}) ;
	};
	
	cover.getBody = function(opts){
		return new nodent.Promise(function($return,$error){
			http.get(opts,function(res){
				try {
					res.setEncoding('utf8');
					var body = "" ;
					res.on('data', function (chunk) { body += chunk ; });
					res.on('end', function(){
						if (res.statusCode==200)
							$return(body) ;
						else {
							var err = new Error("HTTP error "+res.statusCode) ;
							err.body = body ;
							err.res = res ;
							$error(err) ;
						}
					}) ;
				} catch(ex) {
					$error(ex) ;
				}
			}).on('error',$error) ;
		}) ;
	};
	
	return cover ;
};
