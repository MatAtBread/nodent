/* Run all the scripts in ./tests compiled for ES7 and Promises */
var fs = require('fs') ;
var nodent = require('./nodent')() ;

var providers = [
     {name:'nodent',p:nodent.Promise},
//     {name:'bluebird',p:require('bluebird')}
     {name:'ES7',p:null}
] ;

var tests = fs.readdirSync('./tests') ;
providers.forEach(function(promise){
	tests.forEach(function(test){
		var log = console.log.bind(console,test,promise.name) ;
		try {
			var code = fs.readFileSync('./tests/'+test) ;
			var pr = nodent.compile(code,"",3,{es7:true,promises:!!promise.p}) ;
			var m = {} ;
			var fn = new Function("module","require","Promise",pr.code) ;
//			console.log(test,promise.name,":::::\n",fn.toString());
			fn(m,require,promise.p) ;
			if (m.exports) {
				var asyncCall = m.exports() ; 
				asyncCall.then(function(result){
					if (result!==true)
						log("***",result) ;
					else
						log("passed") ;
				}) ;
			}
		} catch (ex) {
			log("***",ex) ;
		}
	}) ;
}) ;
//console.log(tests.length+" tests passed") ;
