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
	{name:'when',p:require('when').promise},
	{name:'nodent-ES7',p:null}
] ;

//argv[3]: name of test run
var tests = process.argv[3] ? [process.argv[3]]:fs.readdirSync('./tests') ;

debugger ;
for (var j=0; j<tests.length; j++) {
	for (var i=0; i<providers.length; i++) {
		var promise = providers[i] ;
		var test = tests[j] ;
		if (test=="index.js" || !test.match(/.*\.js$/))
			continue ;

		var log = console.log.bind(console,test,promise.name) ;

		var code = fs.readFileSync('./tests/'+test) ;
		var pr = nodent.compile(code,"",3,{es7:true,promises:!!promise.p}) ;
		var m = {} ;
		var fn = new Function("module","require","Promise",pr.code) ;

		fn(m,require,promise.p) ;
		await sleep(500);
		try {
			var t = Date.now() ;
			var result = await m.exports(); 
			t = Date.now()-t ;
			if (result!==true) {
				log(t+"ms","***",result) ;
			} else {
				log(t+"ms","passed") ;
			}
		} catch (ex) {
			log("***",ex) ;
		}
	}
}
