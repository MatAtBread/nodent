module.exports = function(nodent,config) {
	nodent.require('events') ;

    if (!config) config = {} ;
    if (!config.Promise)
        config.Promise = global.Promise || nodent.Thenable ;
    
    var http = require('https') ;
	var cover = Object.create(http) ;

	cover.request = function(opts){
		return new (opts.Promise || config.Promise)(function($return,$error){
			var request = http.request(opts,function(){}) ;
			request.on('error',$error) ;
			$return(request) ;
		}) ;
	};
	
	cover.get = function(opts){
		return new (opts.Promise || config.Promise)(function($return,$error){
			http.get(opts,$return).on('error',$error) ;
		}) ;
	};
	
	cover.getBody = function(opts){
		return new (opts.Promise || config.Promise)(function($return,$error){
			http.get(opts,function(res){
				try {
					var enc = "utf8" ;
					if (res.headers['content-type']) {
						var m = res.headers['content-type'].match(/.*charset=(.*)\b/) ;
						if (m && m.length>1 && Buffer.isEncoding(m[1]))
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
