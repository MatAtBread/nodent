/**
 * Create an instance of noDent friendly http with the API:
 * 		res <<== nodent.http.get(opts) ;
 * 			... set up some stuff with res...
 * 		undefined <<= res.wait('end') ;
 */

module.exports = function(nodent,config) {
	nodent.require('events') ;
	var protos = {http:require('http')} ;
	var cover = Object.create(protos.http) ;
	var protocol ;
	if (config && config.autoProtocol) {
		protos.https = require('https') ;
		protocol = function(opts){
			var p ;
			if (typeof opts==="string") {
				p = opts.split(":")[0] ;
			} else if (typeof opts==="object") {
				p = opts.protocol.replace(/:?$/,"") ;
			} 
			if (p && protos[p]) return protos[p] ;
			throw new Error("Protocol is not http or https") ;
		}
	} else {
		protocol = function(){return protos.http;} ; 
	}

	cover.request = function(opts){
		return new nodent.Thenable(function($return,$error){
			var request = protocol(opts).request(opts,function(){}) ;
			request.on('error',$error) ;
			$return(request) ;
		}) ;
	};

	cover.get = function(opts){
		return new nodent.Thenable(function($return,$error){
			protocol(opts).get(opts,$return).on('error',$error) ;
		}) ;
	};

	cover.getBody = function(opts){
		return new nodent.Thenable(function($return,$error){
			protocol(opts).get(opts,function(res){
				try {
					var enc = "utf8" ;
					if (res.headers['content-type']) {
						var m = res.headers['content-type'].match(/.*charset=(.*)\b/) ;
						if (m && m.length>1)
							enc = m[1] ;
					}
					var body = "" ;
					function handle(s) {
						s.on('error',$error) ;
						s.on('data', function (chunk) { 
							body += chunk ; 
						});
						s.on('end',function(){
							if (res.statusCode==200)
								$return(body) ;
							else {
								var err = new Error("HTTP error "+res.statusCode) ;
								err.body = body ;
								err.res = res ;
								$error(err) ;
							}
						}) ;
						return s ;
					}
					
					switch (res.headers['content-encoding']) {
					// or, just use zlib.createUnzip() to handle both cases
					case 'gzip':
					case 'deflate':
						var z = require('zlib').createUnzip() ;
						handle(z);
						res.pipe(z);
						break;
					default:
						res.setEncoding(enc);
						handle(res) ;
						break;
					}					
				} catch(ex) {
					$error(ex) ;
				}
			}).on('error',$error) ;
		}) ;
	};
	return cover ;
};
