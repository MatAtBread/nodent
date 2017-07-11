var parser = require('./lib/parser') ;
var treeSurgeon = require('./lib/arboriculture') ;
var outputCode = require('./lib/output') ;

/* Utils */
function copyObj(a){
    var o = {} ;
    a.forEach(function(b){
        if (b && typeof b==='object')
            for (var k in b)
                o[k] = b[k]  ;
    }) ;
    return o ;
}

function btoa(str) {
    var buffer ;
    if (str instanceof Buffer) {
        buffer = str;
    } else {
        buffer = new Buffer(str.toString(), 'binary');
    }

    return buffer.toString('base64');
}

function noLogger(){}

/* NodentCompiler prototypes, that refer to 'this' */
function compile(code,origFilename,__sourceMapping,opts) {
    if (typeof __sourceMapping==="object" && opts===undefined)
        opts = __sourceMapping ;

    opts = opts || {} ;

    // Fill in any default codeGen options
    for (var k in NodentCompiler.initialCodeGenOpts) {
        if (!(k in opts))
            opts[k] = NodentCompiler.initialCodeGenOpts[k] ;
    }

    var pr = this.parse(code,origFilename,null,opts);
    this.asynchronize(pr,null,opts,this.log || noLogger) ;
    this.prettyPrint(pr,opts) ;
    return pr ;
}

function prettyPrint(pr,opts) {
    var map ;
    var filepath = pr.filename ? pr.filename.split("/") :["anonymous"] ;
    var filename = filepath.pop() ;

    var out = outputCode(pr.ast,(opts && opts.sourcemap)?{map:{
        startLine: opts.mapStartLine || 0,
        file: filename+"(original)",
        sourceMapRoot: filepath.join("/"),
        sourceContent: pr.origCode
    }}:null, pr.origCode) ;

    if (opts && opts.sourcemap){
        try {
            var mapUrl = "" ;
            var jsmap = out.map.toJSON();
            if (jsmap) {
                // require an expression to defeat browserify
                var SourceMapConsumer = require('source-map').SourceMapConsumer;
                pr.sourcemap = jsmap ;
                this.smCache[pr.filename] = {map:jsmap,smc:new SourceMapConsumer(jsmap)} ;
                mapUrl = "\n\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,"
                    +btoa(JSON.stringify(jsmap))+"\n" ;
            }
            pr.code = out.code+mapUrl ;
        } catch (ex) {
            pr.code = out ;
        }
    } else {
        pr.code = out ;
    }
    return pr ;
}

function NodentCompiler(members) {
    this.covers = {} ;
    this._ident = NodentCompiler.prototype.version+"_"+Math.random() ;
    this.setOptions(members || {}) ;
}

NodentCompiler.prototype.smCache = {} ;

NodentCompiler.prototype.setOptions = function(members){
    this.log = members.log===false?noLogger:members.log||this.log;
    this.options = copyObj([this.options,members]) ;
    delete this.options.log ;
    return this ;
};

function parseCode(code,origFilename,__sourceMapping,opts) {
    if (typeof __sourceMapping==="object" && opts===undefined)
        opts = __sourceMapping ;

    var r = { origCode:code.toString(), filename:origFilename } ;
    try {
        r.ast = parser.parse(r.origCode, opts && opts.parser) ;
        if (opts.babelTree) {
            parser.treeWalker(r.ast,function(node,descend,path){
                if (node.type==='Literal')
                    path[0].replace(treeSurgeon.babelLiteralNode(node.value)) ;
                else if (node.type==='Property') {
                    // Class/ObjectProperty in babel6
                    if (path[0].parent.type==='ClassBody'){
                        // There's no easy mapping here as it appears to be borderline in the specification?
                        // It's definitely a kind of ClassProperty tho....
                        node.type = 'ClassProperty' ;
                    } else {
                        node.type = 'ObjectProperty' ;
                    }
                }
                descend() ;
            }) ;
        }
        return r ;
    } catch (ex) {
        if (ex instanceof SyntaxError) {
            var l = r.origCode.substr(ex.pos-ex.loc.column) ;
            l = l.split("\n")[0] ;
            ex.message += " "+origFilename+" (nodent)\n"+l+"\n"+l.replace(/[\S ]/g,"-").substring(0,ex.loc.column)+"^" ;
            ex.stack = "" ;
        }
        throw ex ;
    }
}

NodentCompiler.prototype.version =  require("./package.json").version ;
NodentCompiler.prototype.isThenable = function(x) { return x && x instanceof Object && typeof x.then==="function"} ;
// Exported ; but not to be used lightly!
NodentCompiler.prototype.parse = parseCode ;
NodentCompiler.prototype.compile =  compile ;
NodentCompiler.prototype.asynchronize =  treeSurgeon.asynchronize ;
NodentCompiler.prototype.prettyPrint =  prettyPrint ;
NodentCompiler.prototype.getDefaultCompileOptions = undefined ;

Object.defineProperty(NodentCompiler.prototype,"Promise",{
    get:function (){
        initOpts.log("Warning: nodent.Promise is deprecated. Use nodent.Thenable instead");
        return Thenable;
    },
    enumerable:false,
    configurable:false
}) ;

NodentCompiler.initialCodeGenOpts = {
    noRuntime:false,
    lazyThenables:false,
    es6target:false,
    noUseDirective:false,
    wrapAwait:null,
    mapStartLine:0,
    sourcemap:true,
    engine:false,
    parser:{sourceType:'script'},
    $return:"$return",
    $error:"$error",
    $arguments:"$args",
    $asyncspawn:"$asyncspawn",
    $asyncbind:"$asyncbind",
    generatedSymbolPrefix:"$",
    $makeThenable:'$makeThenable'
};

module.exports = NodentCompiler ;