
/* Run all the scripts in ./tests compiled for ES7 and Promises */
var fs = require('fs') ;
var nodent = require('./nodent')() ;
var tests = fs.readdirSync('./tests') ;
global.Promise = nodent.Promise ; //require('bluebird');
tests.forEach(function(test){
	[true,false].forEach(function(promise){
		var log = console.log.bind(console,test,promise?"Promise":"ES7") ;
		try {
			var code = fs.readFileSync('./tests/'+test) ;
			var pr = nodent.compile(code,"",3,{es7:true,promises:promise}) ;
			var m = {} ;
			new Function("module","require",pr.code)(m,require) ;
			var asyncCall = m.exports() ; 
			debugger;
			asyncCall.then(function(result){
				if (result!==true)
					log("***",result) ;
				else
					log("passed") ;
			}) ;
		} catch (ex) {
			log("***",ex) ;
		}
	}) ;
}) ;
//console.log(tests.length+" tests passed") ;