var astring = require('astring') ;
var es = require('escodegen').generate ;
var acorn = require('acorn') ;
var ast = acorn.parse(t.toString()) ;

var f1 = astring(ast) ;
var f2 = es(ast) ;

console.log("astring",f1+"\n >>> "+(new Function("return "+f1))()()) ;
console.log("escodegen",f2+"\n >>> "+(new Function("return "+f2))()()) ;

function t() {
    return "abc"+(2-1)+"def";
}
