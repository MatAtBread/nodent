/* Test parser/output routines, not transformations */

/* For each example, read it, parse it, output it, parse it again and check the trees are unchanged */
var nodent = require('../nodent.js')() ;
var fs = require('fs');

var n = 0 ;
var opts = {parser:{sourceType:'module',onComment:null}} ;
var pass = fs.readdirSync('./tests/syntax').map(function(fn){ return './tests/syntax/'+fn})
	.concat(fs.readdirSync('./tests/semantics').map(function(fn){ return './tests/semantics/'+fn}))
	.map(function(fn){
	var code = fs.readFileSync(fn).toString() ;
	try {
		var ci = nodent.prettyPrint(nodent.parse(code,"",null,opts),opts) ;
		var co = nodent.prettyPrint(nodent.parse(ci.code,"",null,opts)) ;
		ci.code = ci.code.replace(/\s+/g," ") ;
		co.code = co.code.replace(/\s+/g," ") ;
		var eq = eqTree(ci.ast,co.ast) ;
		if (eq && ci.code==co.code) {
			n += 1 ;
			return {name:fn,pass:true} ;
		} else {
			return {name:fn,pass:false} ;
		}
	} catch (ex) {
		ex.message = fn+": "+ex.message ;
		throw ex ;
	}
}) ;
if (n===pass.length)
	console.log("Syntax check - pass "+n+" of "+pass.length) ;
else
	console.log("Syntax check - FAIL "+(pass.length-n)+" of "+pass.length+". Errors:\n",pass.filter(function(p){ return !p.pass})) ;

function locations(k) {
	return ['end','start','loc'].indexOf(k)<0 ;
}

function eqTree(a,b) {
	debugger ;
	var ka = Object.keys(a).filter(locations).sort() ;
	var kb = Object.keys(b).filter(locations).sort() ;
	if (ka.length != kb.length)
		return false ;
	for (var i=0;i<ka.length;i++)
		if (ka[i] != kb[i] || typeof a[ka[i]] != typeof b[kb[i]])
			return false ;
	for (var i=0;i<ka.length;i++)
		if (typeof a[ka[i]] === 'object' && a[ka[i]])
			return eqTree(a[ka[i]],b[kb[i]]) ;
	return true ;
}
