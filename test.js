"use nodent-es7" ;

var fs = require('fs') ;
var tests = fs.readdirSync('./tests') ;
debugger;
for (var i=0; i<tests.length; i++) {
	try {
		var result = await require('./tests/'+tests[i])() ;
		if (result!==true)
			console.log(tests[i],"***",result) ;
	} catch (ex) {
		console.log(tests[i],"***",ex) ;
	}
}
console.log(tests.length+" tests passed") ;