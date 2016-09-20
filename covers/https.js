module.exports = function(nodent,config) {
	nodent.require('events') ;

    if (!config) config = {} ;
    if (!config.Promise)
        config.Promise = global.Promise || nodent.Thenable ;
    
    var http = require('https') ;
	var cover = Object.create(http) ;

	cover.request = function(opts){
		return new (config.Promise)(function($return,$error){
			var request = http.request(opts,function(){}) ;
			request.on('error',$error) ;
			$return(request) ;
		}) ;
	};
	
	cover.get = function(opts){
		return new (config.Promise)(function($return,$error){
			http.get(opts,$return).on('error',$error) ;
		}) ;
	};
	
	cover.getBody = function(opts){
		return new (config.Promise)(function($return,$error){
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
