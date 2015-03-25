"use nodent-promise";

/* Run all the scripts in ./tests compiled for ES7 and Promises */
var fs = require('fs') ;
var nodent = require('../nodent')({
	use:["map"],
	log:function(msg){ msgs.push(msg) }
}) ;
var Promise = nodent.Thenable ;

async function sleep(t) {
	setTimeout($return,t) ;
}
async function breath() {
	var t = Date.now() ;
	setImmediate(function(){
		$return(Date.now()-t) ;
	}) ;
}

var providers = [] ;

providers.push({name:'nodent-es7',p:null});
providers.push({name:'nodent.Thenable',p:nodent.Thenable});
if (global.Promise) {
	providers.push({name:'native',p:global.Promise}) ;
}

try { providers.push({name:'bluebird',p:require('bluebird')}) } catch (ex) { /* Not installed */ }
try { providers.push({name:'rsvp',p:require('rsvp').Promise}) } catch (ex) { /* Not installed */ }
try { providers.push({name:'when',p:require('when').promise}) } catch (ex) { /* Not installed */ }

var msgs = [] ;
var showOutput = false, saveOutput = false, quiet = false, useGenerators = false ;
var idx = 3 ;

for (idx=3; idx < process.argv.length; idx++) {
	if (process.argv[idx]=='--generators') {
		try {
			//eval("var temp = new Promise(function(){}) ; function *(){ return }") ;
		} catch (ex) {
			throw new Error("*** Installed platform does not support Promises or Generators") ;
		}
//		showOutput = true ;
		useGenerators = true ;
//		providers = [{name:'Promises',p:global.Promise}] ;
	} else if (process.argv[idx]=='--out') {
		showOutput = true ;
//		providers = [{name:'nodent.Thenable',p:nodent.Thenable}] ;
	} else if (process.argv[idx]=='--es7') {
		showOutput = true ;
		providers = [{name:'nodent-es7',p:null}] ;
	} else if (process.argv[idx]=='--save') {
		saveOutput = true ;
	} else if (process.argv[idx]=='--quiet') {
		quiet = true ;
	} else {
		break ;
	}
}

function pad(s) {
	return (s+"                        ").substring(0,24)
}

var tests = process.argv.length>idx ? 
	process.argv.slice(idx):
		fs.readdirSync('./tests').map(function(fn){ return './tests/'+fn}) ;

async function runTests() {
	for (var j=0; j<tests.length; j++) {
		var test = tests[j] ;
		if (test.match(/tests\/index.js$/) || !test.match(/.*\.js$/))
			continue ;
		var failed = false ;
		msgs = [] ;

		var samples = -1 ;
		var timeBase = 0 ;

		for (var g=0;g<(useGenerators?2:1);g++) {
			var info = [pad(test)] ;
			if (g>0)
				info.push("x"+samples+"*") ;
			for (var i=0; i<providers.length; i++) {
				var promise = providers[i] ;
				if (g>0 && !promise.p) {
					info.push([promise.name,"n/a"]) ;
					continue ;
				}

				var code = fs.readFileSync(test).toString() ;
				var pr = nodent.compile(code,test,showOutput?2:3,{
					es7:true,promises:!!promise.p,generators:g>0
				}) ;
				var m = {} ;
				var fn = new Function("module","require","Promise","es7",pr.code) ;
				failed = fn.toString() ;
				if (showOutput)
					console.log(failed) ;
				if (saveOutput) {
					fs.writeFileSync(test+".out",failed) ;
				}

				fn(m,require,promise.p || nodent.Thenable,!promise.p) ;
				await sleep(10);

				try {
					var result,t = Date.now() ;
					if (samples<0) {
						samples = 0 ;
						while (Date.now()-t < 50 && samples<1000) {
							result = await m.exports();
							samples++ ;
							if (!(samples&63))
								t += await breath() ;
						}
						timeBase = Date.now()-t ;
						info.push("x"+samples) ;
					} else {
						for (var reSample=0; reSample<samples; reSample++){
							result = await m.exports(); 
							if (!(reSample&63))
								t += await breath() ;
						}
					}

//					var result = await m.exports(); 
					t = Date.now()-t ;
					if (result!==true) {
						info.push([promise.name,"?",result]) ;
					} else {
						failed = null ;
						if (!reSample)
							info.push([promise.name,t+"ms"]) ;
						else
							info.push([promise.name,((t*100/timeBase)|0)+"%"]) ;
					}
				} catch (ex) {
					info.push([promise.name,"EX"]) ;
					msgs.push(promise.name+" EX:"+ex.message+"\n"+ex.stack) ;
				}
			}
			console.log(info.map(pad).join(""));
		}
		if (!quiet && msgs.length)
			msgs.forEach(function(m){ console.log("  "+m)});
	}
}

await runTests() ;
