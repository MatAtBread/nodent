"use nodent-promise";

var nodent = require('./nodent')() ;
var Promise = nodent.Thenable ;
var http = require('http') ;

var h = nodent.generateRequestHandler("./", ".*", {compiler:{promises:true}, runtime:false}) ;

http.createServer(function(req,res){
	if (req.url.match(/\.js$/)) {
		h(req,res,function(){
			res.end() ;
		})
	} else {
		res.setHeader("Content-type","text/html") ;
		res.write("<htm><script>Function.prototype.$asyncbind="+Function.prototype.$asyncbind.toString()+"</script><script src='./a.js'></script></html>") ;
		res.end() ;
	}
}).listen(2345) ;
