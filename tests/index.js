"use nodent-promise";

/* Run all the scripts in ./tests compiled for ES7 and Promises */
var fs = require('fs') ;
var nodent = require('../nodent')({
	use:["map"],
	log:function(msg){ msgs.push(msg) }
}) ;
var Promise = nodent.Thenable ;

global.sleep = async function sleep(t) {
	setTimeout(function(){
		try {
			return async undefined ;
		} catch (ex) {
			throw async ex ;
		}
	},t) ;
}

global.breathe = async function breathe() {
	var t = Date.now() ;
	setImmediate(function(){
		try {
			return async (Date.now()-t) ;
		} catch (ex) {
			throw async (ex) ;
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
var showOutput = false, saveOutput = false, quiet = false, useGenerators = false ;
var idx = 3 ;

for (idx=3; idx < process.argv.length; idx++) {
	if (process.argv[idx]=='--generators') {
		try {
			eval("var temp = new Promise(function(){}) ; function* x(){ return }") ;
		} catch (ex) {
			throw new Error("*** Installed platform does not support Promises or Generators") ;
		}
		useGenerators = true ;
	} else if (process.argv[idx]=='--out') {
		showOutput = true ;
		providers = [{name:'nodent.Thenable',p:nodent.Thenable}] ;
	} else if (process.argv[idx]=='--es7') {
		showOutput = true ;
		providers = [{name:'nodent-es7',p:null}] ;
	} else if (process.argv[idx]=='--save') {
		saveOutput = true ;
	} else if (process.argv[idx]=='--quiet') {
		quiet = true ;
	} else if (process.argv[idx]=='--quick') {
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
		fs.readdirSync('./tests').map(function(fn){ return './tests/'+fn}) ;

async function runTests() {
	for (var j=0; j<tests.length; j++) {
		var test = tests[j] ;
		if (test.match(/tests\/index.js$/) || !test.match(/.*\.js$/))
			continue ;
		var samples = targetSamples ;
		var timeBase = 0 ;
		var failed = false ;
		msgs = [] ;
		for (var g=0;g<(useGenerators?2:1);g++) {
			var info = [pad(test)] ;
			if (g>0 && targetSamples!=1)
				info.push("(using generators)") ;
			for (var i=0; i<providers.length; i++) {
				var promise = providers[i] ;
				if (g>0 && !promise.p) {
					info.push([promise.name]) ;
					continue ;
				}

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
				await sleep(10);

				try {
					var result,t = Date.now() ;
					if (samples<0) {
						samples = 0 ;
						while(1) {
							result = await run(m.exports());
							samples++ ;
							if (!(samples&31)) {
								t += await breathe() ;
								if (Date.now()-t > 100 || samples>10000)
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
						info.push([promise.name,"?",result]) ;
					} else {
						failed = null ;
						if (targetSamples==1)
							info.push([promise.name]) ;
						else if (!reSample)
							info.push([promise.name,t+"ms"]) ;
						else
							info.push([promise.name,((t*100/timeBase)|0)+"%"]) ;
					}
				} catch (ex) {
					info.push([promise.name,"*error*"]) ;
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
