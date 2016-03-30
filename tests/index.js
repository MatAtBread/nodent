"use nodent-promise";

/* Run all the scripts in ./tests compiled for ES7 and Promises */
var fs = require('fs') ;
var path = require('path') ;
var msgs = [] ;
var nodent = require('../nodent')({
    log:function(msg){ msgs.push(msg) }
}) ;
var map = nodent.require('map');
var Promise = global.Promise || nodent.EagerThenable() ;

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

providers.push({name:'nodent-es7',p:null});
providers.push({name:'nodent.Thenable',p:nodent.Thenable});
providers.push({name:'nodent.Eager',p:nodent.EagerThenable()});
if (global.Promise) {
    providers.push({name:'native',p:global.Promise}) ;
}

function makePromiseCompliant(module,promise,resolve) {
    var p = module[promise] ;
    p.resolve = module[resolve] ;
    return p ;
}

try {
    var bluebird = require('bluebird');
    bluebird.config({ warnings: false });
    providers.push({name:'bluebird',p:bluebird});
} catch (ex) { }
try { providers.push({name:'rsvp',p:require('rsvp').Promise}) } catch (ex) { }
try { providers.push({name:'when',p:makePromiseCompliant(require('when'),'promise','resolve')}) } catch (ex) { }
try { providers.push({name:'promiscuous',p:require('promiscuous')}) } catch (ex) { }

var targetSamples = -1 ;
var wrapAwait = false, showOutput = false, saveOutput = false,
quiet = false, useGenerators = false, useGenOnly = false,
notES6 = false, syntaxTest = 0, forceStrict = "" ;
var idx ;

try {
    eval("x=>0") ;
} catch (ex) {
    notES6 = true ;
}

for (idx=0; idx<process.argv.length; idx++) {
    var fqPath = path.resolve(process.argv[idx]) ;
    if (fqPath == __filename || fqPath == __dirname)
        break ;
}

idx += 1 ;

for (;idx < process.argv.length; idx++) {
    var arg = process.argv[idx] ;
    if (arg=='--syntaxonly')
        syntaxTest = 1 ;
    else if (arg.match(/--await=/))
        wrapAwait = arg.split("=")[1] ;
    else if (arg=='--syntax') {
        syntaxTest = 2 ;
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
    } else if (arg=='--output') {
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
    } else if (arg=='--forceStrict') {
        forceStrict = "'use strict';\n" ;
    } else {
        break ;
    }
}

function pad(s) {
    return (s+"                        ").substring(0,24)
}

if (syntaxTest) {
    require('./test-syntax').testFiles(process.argv.length>idx ? process.argv.slice(idx):[__dirname+"/.."],true) ;
    if (syntaxTest==1)
        return ;
}

var files = (process.argv.length>idx ?
    process.argv.slice(idx):
        fs.readdirSync('./tests/semantics').map(function(fn){ return './tests/semantics/'+fn})).filter(function(n){ return n.match(/.*\.js$/)}) ;

if (notES6) {
    files = files.filter(function(n){
        if (n.match(/es6-.*/)) {
            console.log(pad(test.split("/").pop())+" (skipped - ES6 platform not installed)") ;
            return false ;
        }
        return true ;
    }) ;
}

console.log("Compiling...");
var tTotalCompilerTime = 0 ;
var test = [] ;
var i = 0 ;
function time(hr) {
    var t = process.hrtime(hr) ;
    return (t[0]*1e9+t[1])/1e6 ;
}

var types = ['es7','es7-wrapAwait','promises','promises-wrapAwait','generators','generators-wrapAwait']

files.forEach(function(n){
    test[i] = {name:n.split("/").pop().replace(/\.js$/,""),fn:[]} ;
    var code = fs.readFileSync(n).toString() ;
    for (var type=0; type<6; type++) {
        var tCompiler = process.hrtime() ;
        var pr = nodent.compile(forceStrict+code,n,showOutput?2:3,{
            wrapAwait:type & 1,
            es7:true,
            promises:type & 2,
            generators:type & 4
        }).code ;
        tTotalCompilerTime += time(tCompiler) ;
        test[i].fn[type] = new Function("module","require","Promise","es7","nodent",pr) ;
    }
    i += 1 ;
    if (showOutput)
        console.log(pr) ;
}) ;
console.log("Total compile time:",tTotalCompilerTime,"ms");

async function runTest(test,provider,type) {
    var m = {}, result ;
    test.fn[type](m,require,provider.p || nodent.Thenable,!(type & 2),nodent) ;
    var t = process.hrtime() ;
    try {
        result = await m.exports() ;
        if (result!=true) throw result;
    } catch (ex) {
        result = ex;
    }
    return {t:time(t),result:result} ;
}

var result, byType = {}, byProvider = {}, byTest = {} ;
for (var i=0; i<test.length; i++) {
    for (var j=0; j<providers.length; j++) {
        for (var type=(useGenOnly?4:0); type<(useGenerators?6:4); type++) {            
            var t = 0, ticks = [] ;
            // Warm up V8
            result = await runTest(test[i],providers[j],type) ;
            result = await runTest(test[i],providers[j],type) ;
            while (t<100 || ticks.length<12) {
                result = await runTest(test[i],providers[j],type) ;
                ticks.push(result.t) ;
                t += result.t ;
            }
            ticks = ticks.sort() ;
            var median = ticks[ticks.length/2|0] ;
            var metrics = [1000/median|0,median,ticks.length] ;

            byType[types[type]] = byType[types[type]] || [] ;
            byType[types[type]].push(metrics) ;

            byProvider[providers[j].name] = byProvider[providers[j].name] || [] ;
            byProvider[providers[j].name].push(metrics) ;

            byTest[test[i].name] = byTest[test[i].name] || [] ;
            byTest[test[i].name].push(metrics) ;
        }
    }
}

console.log(byType);
console.log(byProvider);

/*
var totalTime = providers.map(function(){ return 0 }) ;
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

async function runTests() {
    for (var j=0; j<files.length; j++) {
        var test = files[j] ;
        var samples = targetSamples ;
        var timeBase = 0 ;
        var failed = false ;
        msgs = [] ;
        for (var g=(useGenOnly?1:0);g<(useGenerators?2:1);g++) {
            for (var wrapAwait=0;wrapAwait<2;wrapAwait++) {
                if (g && wrapAwait) continue ;
                var info = [pad(test.split('/').pop())] ;
                if ((g>0 || wrapAwait>0))
                    info.push("("+(g>0?"generators":"")+(wrapAwait>0?"wrapAwait":"")+")") ;
                for (var i=0; i<providers.length; i++) {
                    var promise = providers[i] ;
                    if ((wrapAwait>0 && i==0) || (g>0 && !promise.p)) {
                        if (i>0)
                            info.push(["(skip "+promise.name+")"]) ;
                        continue ;
                    }

                    try {
                        var code = fs.readFileSync(test).toString() ;
                        var tCompiler = Date.now() ;
                        var pr = nodent.compile(forceStrict+code,test,showOutput?2:3,{
                            wrapAwait:wrapAwait>0,
                            es7:true,
                            promises:!!promise.p,
                            generators:g>0
                        }) ;
                        tTotalCompilerTime += Date.now()-tCompiler ;
                        var m = {} ;
                        if (showOutput)
                            console.log(pr.code) ;
                        var fn = new Function("module","require","Promise","es7","nodent",pr.code) ;
                        failed = fn.toString() ;
                        if (showOutput && saveOutput) {
                            fs.writeFileSync(test+".out",pr.code) ;
                        }

                        fn(m,require,promise.p || nodent.Thenable,!promise.p,nodent) ;
                        await breathe();

                        var result,t = Date.now() ;
                        if (samples<0) {
                            samples = 0 ;
                            while(1) {
                                result = await run(m.exports());
                                samples++ ;
                                if (!(samples&31)) {
                                    t += await breathe() ;
                                    if (Date.now()-t > 50 || samples>5000)
                                        break ;
                                }
                            }
                            timeBase = Date.now()-t ;
                            info.push("x"+samples+", "+timeBase+"ms") ;
                        } else {
                            for (var reSample=0; reSample<samples; reSample++){
                                result = await run(m.exports());
                                if (!(reSample&31))
                                    t += await breathe() ;
                            }
                        }

                        t = Date.now()-t ;
                        totalTime[i] += t ;
                        if (i==0 && targetSamples==1) {
                            info.push("x1, "+t+"ms") ;
                        } else {
                            if (result!==true && result!=='n/a') {
                                info.push([promise.name+" \u2717",result]) ;
                            } else {
                                failed = null ;
                                if (targetSamples==1)
                                    info.push([promise.name+" \u2713"]) ;
                                else if (reSample && i>0)
                                    info.push([promise.name,((t*100/timeBase)|0)+"%"]) ;
                            }
                        }
                    } catch (ex) {
                        info.push([promise.name+" \u2717","*error*"]) ;
                        msgs.push(promise.name+" EX:"+ex.toString()+"\n"+ex.stack) ;
                    }
                }
                console.log(info.map(pad).join(""));
            }
        }
        if (!quiet && msgs.length)
            msgs.forEach(function(m){ console.log("  "+m)});
    }
}

console.log(pad("Implementation times:"),providers.map(function(p,i){ return pad(totalTime[i]+"ms")}).join(""));
 */
