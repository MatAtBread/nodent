"use nodent-promise";

/* Run all the scripts in ./tests compiled for ES7 and Promises */
var fs = require('fs') ;
var nodent = require('../nodent')() ;
var Promise = nodent.Thenable ;

async function sleep(t) {
	setTimeout($return,t) ;
}

var providers = [] ;
if (global.Promise) {
    providers.push({name:'global',p:global.Promise}) ;
}

providers = providers.concat([
    {name:'nodent-ES7',p:null},
 	{name:'nodent-Thenable',p:nodent.Thenable},
	{name:'bluebird',p:require('bluebird')},
	{name:'rsvp',p:require('rsvp').Promise},
	{name:'when',p:require('when').promise}
]) ;

var showOutput = false ;
var idx = 3 ;
if (process.argv[3]=='--out') {
	showOutput = true ;
	idx += 1 ;
}
var tests = process.argv.length>idx ? process.argv.slice(idx):fs.readdirSync('./tests') ;

async function runTests() {
	for (var j=0; j<tests.length; j++) {
		var test = tests[j] ;
		if (test=="index.js" || !test.match(/.*\.js$/))
			continue ;
		var info = [(test+"        ").substring(0,15)] ;
		var failed = false ;
		for (var i=0; i<providers.length; i++) {
			var promise = providers[i] ;
	
			var code = fs.readFileSync('./tests/'+test).toString() ;
			var pr = nodent.compile(code,test,3,{es7:true,promises:!!promise.p}) ;
			var m = {} ;
			var fn = new Function("module","require","Promise",pr.code) ;
			failed = fn.toString() ;
			if (showOutput)
				console.log(failed) ;
	
			fn(m,require,promise.p) ;
			await sleep(10);
			try {
				var t = Date.now() ;
				var result = await m.exports(); 
				t = Date.now()-t ;
				if (result!==true) {
					info.push([promise.name,"?",result]) ;
				} else {
					failed = null ;
					info.push([promise.name,t+"ms"]) ;
				}
			} catch (ex) {
				info.push([promise.name,"CATCH",ex]) ;
			}
		}
		console.log(info.join("\t"));
	//	if (failed)
	//		console.log(failed) ;
	}
}

await runTests() ;
