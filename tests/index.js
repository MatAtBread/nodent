"use nodent-promise";

/* Run all the scripts in ./tests compiled for ES7 and Promises */
var fs = require('fs') ;
var nodent = require('../nodent')() ;
var Promise = nodent.Thenable ;

async function sleep(t) {
	setTimeout($return,t) ;
}

var providers = [
    {name:'nodent-ES7',p:null},
 	{name:'nodent-Thenable',p:nodent.Thenable},
	{name:'bluebird',p:require('bluebird')},
	{name:'rsvp',p:require('rsvp').Promise},
	{name:'when',p:require('when').promise}
] ;

//argv[3]: name of test run
var tests = process.argv[3] ? [process.argv[3]]:fs.readdirSync('./tests') ;

for (var j=0; j<tests.length; j++) {
	var test = tests[j] ;
	if (test=="index.js" || !test.match(/.*\.js$/))
		continue ;
	var info = [(test+"        ").substring(0,15)] ;
	for (var i=0; i<providers.length; i++) {
		var promise = providers[i] ;

		var code = fs.readFileSync('./tests/'+test).toString() ;
		var pr = nodent.compile(code,test,3,{es7:true,promises:!!promise.p}) ;
		var m = {} ;
		var fn = new Function("module","require","Promise",pr.code) ;

		fn(m,require,promise.p) ;
		await sleep(0);
		try {
			var t = Date.now() ;
			var result = await m.exports(); 
			t = Date.now()-t ;
			if (result!==true) {
				info.push([promise.name,"?",result]) ;
			} else {
				info.push([promise.name,t+"ms"]) ;
			}
		} catch (ex) {
			info.push([promise.name,"CATCH",ex]) ;
		}
	}
	console.log(info.join("\t"));
}
