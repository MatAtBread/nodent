try {
    process.stdout.write('\033[2J\033[1;1H') ;
    var nodent = require('../nodent.js')({log:function(){}}) ;
    var options = {
        sourcemap:false,
        es7:true,
        promises:true
    } ;
    var src = require('fs').readFileSync(process.argv[2]).toString() ;
    options = nodent.parseCompilerOptions(src) || {};
    options.sourcemap = false ;
    pr = nodent.compile(src,"source.js",0,options) ;
    console.log(pr.code) ;
    eval(pr.code) ;
} catch (ex) {
    console.warn(ex) ;
}
