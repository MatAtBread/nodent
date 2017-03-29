'use nodent-es7 {"lazyThenables":true}';

/* Run all the scripts in ./tests compiled for ES7 and Promises */
var fs = require('fs');
var path = require('path');
var color = require('colors');
var nodent = require('../nodent')({
    log: function (msg) {}
});
var nativePromise = global.Promise ;
var gc = global.gc || function(){} ;
var AsyncFunction = nodent.require('asyncfunction') ;
var map = nodent.require('map');
var spaces = '                                                                 ' ;
global.sleep = async function sleep(t) {
    setTimeout(function () {
        try {
             async return undefined;
        } catch (ex) {
             async throw ex;
        }
    }, t);
};
global.breathe = async function breathe() {
    var hr = process.hrtime();
    setImmediate(function () {
        try {
            var t = process.hrtime(hr);
            t = t[0] * 1000 + t[1] / 1e6 ;
            async return t;
        } catch (ex) {
             async throw ex;
        }
    });
};
var providers = [];
providers.push({
    name: '{es7:true}',
    p: null
});
providers.push({
    name: 'nodent',
    p: nodent.Thenable
});
if (nativePromise) {
    providers.push({
        name: 'native',
        p: nativePromise
    });
}
function makePromiseCompliant(module, promise, resolve) {
    var p = module[promise];
    p.resolve = module[resolve];
    return p;
}

var promiseImpls = providers.length;

try {
    var bluebird = require('bluebird');
    bluebird.config({
        warnings: false
    });
    providers.push({
        name: 'bluebird',
        p: bluebird
    });
} catch (ex) {}
try {
    providers.push({
        name: 'rsvp',
        p: require('rsvp').Promise
    });
} catch (ex) {}
try {
    providers.push({
        name: 'when',
        p: makePromiseCompliant(require('when'), 'promise', 'resolve')
    });
} catch (ex) {}
try {
    providers.push({
        name: 'promisejs.org',
        p: require('promise')
    });
} catch (ex) {}
try {
    providers.push({
        name: 'promiscuous',
        p: require('promiscuous')
    });
} catch (ex) {}
var useQuick = false, quiet = false, useGenerators = true, useGenOnly = false, syntaxTest = 0, 
    forceStrict = "'use strict';\n", useEngine = true, useES6 = true, noNodentExtensions = false ;
var idx;
for (idx = 0; idx < process.argv.length; idx++) {
    var fqPath = path.resolve(process.argv[idx]);
    if (fqPath == __filename || fqPath == __dirname)
        break;
}
idx += 1;
for (; idx < process.argv.length; idx++) {
    var arg = process.argv[idx];
    if (arg == '--syntaxonly')
        syntaxTest = 1;
     else if (arg == '--syntax') {
        syntaxTest = 2;
     } else if (arg == '--noengine') {
       useEngine = false;
     } else if (arg == '--nogenerators') {
         useGenerators = false;
     } else if (arg == '--generators' || arg == '--genonly') {
         useGenOnly = arg == '--genonly';
         useGenerators = true;
    } else if (arg == '--output' || arg == '--es7' || arg == '--save') {
        console.log('Option '.grey+arg+' is deprecated and will be ignored.'.grey)
    } else if (arg == '--quiet') {
        quiet = true;
    } else if (arg == '--quick') {
        useQuick = true;
    } else if (arg == '--notStrict') {
        forceStrict = "";
    } else if (arg == '--noNodentExtensions') {
        noNodentExtensions = true;
    } else {
        break;
    }
}

if (forceStrict) {
    console.log("Running tests with", "'use strict'".yellow);
} else {
    console.log("Running tests without 'use strict'");
}

if (useEngine) {
  try {
      eval("async function x(){ return await null }");
  } catch (ex) {
      console.log(("V8 "+process.versions.v8+" does not support async/await (try a later version of nodejs). Skipping 'use nodent-engine' tests. ").yellow) ;
      useEngine = false;
  }
}

if (useGenerators) {
    try {
        eval("var temp = new Promise(function(){}) ; function* x(){ return }");
    } catch (ex) {
        console.log(("V8 "+process.versions.v8+" does not support Promises or Generators (try a later version of nodejs). Skipping 'use nodent-generator' tests. ").yellow) ;
        if (useGenOnly)
            process.exit(-1);
        useGenerators = false ;
    }
}

try {
    eval("(a)=>0") ;
} catch (ex) {
    console.log(("V8 "+process.versions.v8+" does not arrow functions. Skipping es6target tests. ").yellow) ;
    useES6 = false ;
}

function pad(s, n) {
    return ("                                " + s).substr(-(n || 32));
}

if (syntaxTest) {
    require('./test-syntax').testFiles(process.argv.length > idx ? process.argv.slice(idx) : [__dirname + "/.."], true);
    if (syntaxTest == 1)
        return;
}
var files = (process.argv.length > idx ? process.argv.slice(idx) : fs.readdirSync('./tests/semantics').map(function (fn) {
    return './tests/semantics/' + fn;
})).filter(function (n) {
    return n.match(/.*\.js$/);
});

var tTotalCompilerTime = 0;
var test = [];
var i = 0;
function time(hr) {
    var t = process.hrtime(hr);
    return t[0] * 1000 + t[1] / 1e6;
}

function DoNotTest() {
    throw DoNotTest;
}

var types = [];
files.forEach(function (n) {
    test[i] = {
        name: n.split("/").pop().replace(/\.js$/, ""),
        fn: []
    };
    process.stdout.write('\r- Compiling ' + test[i].name + '                         \r');
    var code = fs.readFileSync(n).toString();
    var dualMode = n.match(/\/dual-/) ;
    if (dualMode) {
        code = "module.exports = async function() { "+
            "var s = _s(), a = await _a() ;"+
            "if (s !== a) {console.log(s,a)} "+
            "return s === a }\n"+
            "function _s() { "+forceStrict + code.replace(/async|await/g,"")+" }\n"+
            "async function _a() { "+forceStrict + code+" }" ;
    }
    var compileException = false;
    for (var mode = 0; mode < 5; mode++) {
        for (var flags=0; flags<8; flags++) {
            var opts = {} ;
            if (noNodentExtensions)
                opts.parser = { noNodentExtensions: true } ;

            switch (mode) {
            case 0: // es7 (lazy)
                opts.es7 = true ;
                opts.lazyThenables = true ;
                break;
            case 1: // es7 (eager)
                opts.es7 = true ;
                break;
            case 2: // Promises
                opts.promises = true ;
                break;
            case 3: // Generators 
                if (!useGenerators)
                    continue ;
                opts.generators = true ;
                break;
            case 4: // Engine
                if (!useEngine)
                    continue ;
                opts.engine = true ;
                break;
            }
            if (flags & 1) {
                if (!useES6)
                    continue ;
                opts.es6target = true ;
            }
            if (flags & 2) {
                if (!(opts.promises || opts.engine))
                    continue ;
                opts.noRuntime = true ;
            }
            if (flags & 4)
                opts.wrapAwait = true ;
            
            var type = mode*8+flags ;
            types[type] = Object.keys(opts).toString() ;
    
            try {
                var pr, tCompiler = process.hrtime();
                pr = nodent.compile(forceStrict + code, n, opts).code;
                tTotalCompilerTime += time(tCompiler);
                try {
                    test[i].fn[type] = new Function("module", "require", "Promise", "__unused", "nodent", "DoNotTest", pr);
                    test[i].fn[type].opts = opts ;
                } catch (ex) {
                    if (!compileException)
                        console.warn(test[i].name+(" not supported by V8 "+process.versions.v8+" (try a later version of nodejs): ").yellow+ex.message.red) ;
                    compileException = true ;
                    test[i].fn[type] = function(m) {
                        m.exports = DoNotTest ;
                    }
                }
            } catch (ex) {
                if (!compileException)
                    console.warn(test[i].name+(" nodent failed to compile ").yellow+" ("+types[type]+") "+ex.message.red) ;
                compileException = true ;
                test[i].fn[type] = function(m) {
                    m.exports = DoNotTest ;
                }
            }
        }
    }
    i += 1;
});
console.log("Total compile time:", ((tTotalCompilerTime | 0) + "ms").yellow);
if (useQuick)
    console.log('Note:'.cyan,'Timings with '+'--quick'.underline+' are subject to significant GC jitter. Remove '+'--quick'.underline+' for accurate timing comparison');
if (promiseImpls == providers.length)
    console.log('To test against some popular Promise implementations,', 'cd tests && npm i && cd ..'.yellow);

var testCache = {} ;
async function runTest(test, provider, type) {
    if (!test.fn[type].opts || (provider.p && !(test.fn[type].opts.promises || test.fn[type].opts.generators || test.fn[type].opts.engine))) {
        return {
            result: DoNotTest
        };
    }
    
    if (!provider.p && test.fn[type].opts.engine) {
        return {
            result: DoNotTest
        };
    }
    
    
    await sleep(1);
    var key = [test.name,provider.name,type].join();
    var m = {};
    if (!testCache[key]) {
        test.fn[type](m, require, provider.p || DoNotTest, undefined, nodent, DoNotTest);
        testCache[key] = m ;
    } else {
        m = testCache[key] ;
    }
    var returned = false ;
    function onResult(r) {
        if (tID) {
            clearTimeout(tID) ;
            tID = null ;
        }
        if (returned)
            return ;
        returned = true ;
        async return {
            alwaysQuick: m.exports.alwaysQuick,
            t: time(t),
            result: r
        }
    }
    try {
        var thenable = m.exports();
        var tID = setTimeout(function(){
            tID = null ;
            if (returned)
                return ;
            console.log("Timeout".red,test.name,provider.name.yellow);
            onResult(new Error("Timed out")) ;
        },10000) ;
        var t = process.hrtime();
        thenable.then(onResult,onResult) ;
    } catch (ex) {
		return {
            alwaysQuick: m.exports.alwaysQuick,
            t: t?time(t):10000,
            result: ex
        }
    }
}

try {
    var result, byType = {}, byProvider = {}, byTest = {}, table = [], fails = [], tMedian = 0, nMedian = 0 ;
    var maxLines = 0 ;
    nextTest: for (i = 0;i < test.length; i++) {
        var benchmark = null;
        nextProvider: for (var j = 0;j < providers.length; j++) {
            try {
              process.stdout.write('\r- Test: ' + test[i].name + ' using ' + providers[j].name.yellow + spaces + '\n');
              gc() ;

              for (var type in types) if (Object.getOwnPropertyDescriptor(types,type)) {
                  table[type] = table[type] || [];
                  table[type][j] = table[type][j] || [];
                  // Warm up V8
                  result = await runTest(test[i], providers[j], type);
                  if (result.result !== true) {
                      if (result.result !== DoNotTest) {
                          console.log(test[i].name, '\u2717'.red, types[type].red, providers[j].name.red, result.result.toString().red, spaces);
                          continue nextProvider ;
                      }
                      continue;
                  }
                  var t = 0;
                  var ticks = [];
                  var cond = result.alwaysQuick?function(){ return ticks.length < result.alwaysQuick } : ( useQuick ? function () {
                      return ticks.length < 2;
                  } : function () {
                      return (t < 100 || ticks.length < 20) && ticks.length < 200;
                  });
                  while (cond()) {
                      result = await runTest(test[i], providers[j], type);
                      ticks.push(result.t);
                      t += result.t;
                  }
                  ticks = ticks.sort();
                  var median = ticks[ticks.length / 2 | 0];
                  var metric = median;
                  if (!benchmark) {
                      benchmark = metric;
                      tMedian = tMedian+benchmark ;
                      nMedian += 1 ;
                  }
                  metric = metric / benchmark * 100;
                  result = {
                      value: result.result,
                      metric: metric,
                      provider: providers[j].name,
                      type: types[type],
                      test: test[i].name
                  };
                  table[type][j].push(metric);
                  byType[types[type]] = byType[types[type]] || [];
                  byType[types[type]].push(result);
                  byProvider[providers[j].name] = byProvider[providers[j].name] || [];
                  byProvider[providers[j].name].push(result);
              }
              console.log(spaces+'\n') ;
              var lines = 2+showPerformanceTable() ;
              if (maxLines < lines+1)
                  maxLines = lines+1 ;
              while (lines--) {
                  process.stdout.write('\u001B[1A') ;
              }
            } catch(ex) {
              fails.push(test[i].name.yellow + ' using ' + providers[j].name.yellow + ': ',ex.toString().red);
            } finally {
              process.stdout.write('\u001B[1A') ;
            }
        }
    }

    while (maxLines--) console.log("") ;
    console.log('Benchmark execution time: '+((tMedian/nMedian)+' ms').cyan) ;
    console.log(fails.join("\n")) ;

    function showPerformanceTable() {
        var i,j,lines = 0 ;
        function log() {
            console.log.apply(console,arguments) ;
            lines++ ;
        }
        function extract(a, field) {
            if (!Array.isArray(a)) {
                return NaN;
            }
            return a.map(function (n) {
                return n[field];
            });
        }

        function avg(by) {
            if (!Array.isArray(by))
                return NaN;
            return by.filter(function (n) {
                return typeof n === 'number';
            }).reduce(function (a, b) {
                return a + b;
            }, 0) / by.length;
        }

        function traffic(n) {
            if (isNaN(n))
                return pad('-', 16).blue;
            if (n < 120)
                return pad('' + (n | 0), 16).green;
            if (n < 200)
                return pad('' + (n | 0), 16).white;
            if (n < 300)
                return pad('' + (n | 0), 16).yellow;
            return pad('' + (n | 0), 16).red;
        }

        var n;
        var fidx = Object.keys(table)[0] ;
        n = pad('') + pad('', 16);
        for (i = 0; i < table[fidx].length; i++) {
            n += pad(providers[i].name, 16);
        }
        log(n);
        n = pad('Compiler flags') + pad('Mean', 16);
        for (i = 0; i < table[fidx].length; i++) {
            n += traffic(avg(extract(byProvider[providers[i].name], 'metric')));
        }
        log(n.underline);
        for (i = 0; i < table.length; i++) {
            var typed = table[i];
            if (typed) {
                n = pad(types[i]) + traffic(avg(extract(byType[types[i]], 'metric')));
                for (j = 0; j < typed.length; j++) {
                    n += traffic(avg(typed[j]));
                }
                log(n);
            }
        }
        log('');
        return lines ;
    }
} catch (ex) {
    console.error(ex.stack || ex);
}
