"use nodent-promise";

/* Run all the scripts in ./tests compiled for ES7 and Promises */
var fs = require('fs') ;
var nodent = require('../nodent')({
	log:function(msg){ msgs.push(msg) }
}) ;
var Promise = nodent.Thenable ;

global.sleep = async function sleep(t) {
	setTimeout(function(){
		try {
			async return undefined ;
		} catch (ex) {
			async throw ex ;
		}
	},t) ;
}

global.breathe = async function breathe() {
	var t = Date.now() ;
	setImmediate(function(){
		try {
			async return (Date.now()-t) ;
		} catch (ex) {
			async throw (ex) ;
		}
	}) ;
}

var providers = [] ;

providers.push({name:'sample',p:null});
providers.push({name:'nodent-es7',p:null});
providers.push({name:'nodent.Thenable',p:nodent.Thenable});
if (global.Promise) {
	providers.push({name:'native',p:global.Promise}) ;
}

try { providers.push({name:'bluebird',p:require('bluebird')}) } catch (ex) { }
try { providers.push({name:'rsvp',p:require('rsvp').Promise}) } catch (ex) { }
try { providers.push({name:'when',p:require('when').promise}) } catch (ex) { }

var msgs = [] ;
var targetSamples = -1 ;
var showOutput = false, saveOutput = false, quiet = false, useGenerators = false, useGenOnly = false, notES6 = false ;
var idx ;

try {
	eval("x=>0") ;
} catch (ex) {
	notES6 = true ;
}

for (idx=3; idx < process.argv.length; idx++) {
	var arg = process.argv[idx] ;
	if (arg=='--syntaxonly')
		return require('./test-syntax') ;
	if (arg=='--syntax') {
		require('./test-syntax') ;
	} else if (arg=='--generators' || arg=='--genonly') {
		try {
			useGenOnly = arg=='--genonly' ;
			eval("var temp = new Promise(function(){}) ; function* x(){ return }") ;
			useGenerators = true ;
			if (useGenOnly)
				providers.splice(1,1) ;
		} catch (ex) {
			console.warn("OOPS! Installed platform does not support Promises or Generators - skipping some tests") ;
			if (useGenOnly)
				process.exit(-1);
		}
	} else if (arg=='--out') {
		showOutput = true ;
		providers = [{name:'nodent.Thenable',p:nodent.Thenable}] ;
	} else if (arg=='--es7') {
		showOutput = true ;
		providers = [{name:'nodent-es7',p:null}] ;
	} else if (arg=='--save') {
		saveOutput = true ;
	} else if (arg=='--quiet') {
		quiet = true ;
	} else if (arg=='--quick') {
		targetSamples = 1 ;
	} else {
		break ;
	}
}

function pad(s) {
	return (s+"                        ").substring(0,24)
}

async function run(fn) {
	var tid = setTimeout(function(){
		var x = $error ;
		$return = null ;
		$error = null ;
		return x(new Error("timeout")) ;
	},5000) ;
	
	fn.then(function(r){
		tid && clearTimeout(tid) ;
		return $return && $return(r) ;
	},function(ex){
		tid && clearTimeout(tid) ;
		return $error && $error(ex) ;
	}) 
}

var tests = process.argv.length>idx ? 
	process.argv.slice(idx):
		fs.readdirSync('./tests/semantics').map(function(fn){ return './tests/semantics/'+fn}) ;

async function runTests() {
	for (var j=0; j<tests.length; j++) {
		var test = tests[j] ;
		if (test.match(/tests\/index.js$/) || !test.match(/.*\.js$/))
			continue ;
		if (notES6 && test.match(/es6-.*/)) {
			console.log(pad(test)+" (skipped - ES6 platform not installed)") ;
			continue ;
		}
		var samples = targetSamples ;
		var timeBase = 0 ;
		var failed = false ;
		msgs = [] ;
		for (var g=(useGenOnly?1:0);g<(useGenerators?2:1);g++) {
			var info = [pad(test.split('/').pop())] ;
			if (g>0 && targetSamples!=1)
				info.push("(using generators)") ;
			for (var i=0; i<providers.length; i++) {
				var promise = providers[i] ;
				if (g>0 && !promise.p) {
					info.push(["(skip "+promise.name+")"]) ;
					continue ;
				}

				try {
					var code = fs.readFileSync(test).toString() ;
					var pr = nodent.compile(code,test,showOutput?2:3,{
						es7:true,promises:!!promise.p,generators:g>0
					}) ;
					var m = {} ;
					if (showOutput)
						console.log(pr.code) ;
					var fn = new Function("module","require","Promise","es7",pr.code) ;
					failed = fn.toString() ;
					if (showOutput && saveOutput) {
						fs.writeFileSync(test+".out",pr.code) ;
					}

					fn(m,require,promise.p || nodent.Thenable,!promise.p) ;
					await breathe();

					var result,t = Date.now() ;
					if (samples<0) {
						samples = 0 ;
						while(1) {
							result = await run(m.exports());
							samples++ ;
							if (!(samples&31)) {
								t += await breathe() ;
								if (Date.now()-t > 50 || samples>10000)
									break ;
							}
						}
						timeBase = Date.now()-t ;
						info.push("x"+samples) ;
					} else {
						for (var reSample=0; reSample<samples; reSample++){
							result = await run(m.exports()); 
							if (!(reSample&31))
								t += await breathe() ;
						}
					}

					t = Date.now()-t ;
					if (result!==true) {
						info.push([promise.name+" \u2717",result]) ;
					} else {
						failed = null ;
						if (targetSamples==1)
							info.push([promise.name+" \u2713"]) ;
						else if (!reSample)
							info.push([promise.name,t+"ms"]) ;
						else
							info.push([promise.name,((t*100/timeBase)|0)+"%"]) ;
					}
				} catch (ex) {
					info.push([promise.name+" \u2717","*error*"]) ;
					msgs.push(promise.name+" EX:"+ex.toString()+"\n"+ex.stack) ;
				}
			}
			console.log(info.map(pad).join(""));
		}
		if (!quiet && msgs.length)
			msgs.forEach(function(m){ console.log("  "+m)});
	}
}

await runTests() ;
