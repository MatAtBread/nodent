/* Test parser/output routines, not async transformations */
var nodent = require('../nodent.js')() ;
var fs = require('fs');

var n = 0 ;
var opts = {parser:{sourceType:'module',onComment:null}} ;

/* For each example, read it, parse it, output it, parse it again and check the trees & code strings are the same */

var pass = ['./t.js'] ;
//var pass = fs.readdirSync('./tests/syntax').map(function(fn){ return './tests/syntax/'+fn})
//	.concat(fs.readdirSync('./tests/semantics').map(function(fn){ return './tests/semantics/'+fn}))
//	.concat(fs.readdirSync('./lib').map(function(fn){ return './lib/'+fn}))
//	.concat('./nodent.js');

//List all files in a directory in Node.js recursively in a synchronous fashion
function walkSync(dir, filelist) {
	filelist = filelist || [];
	if( dir[dir.length-1] != '/') dir=dir.concat('/')
	var fs = fs || require('fs'),
	files = fs.readdirSync(dir);
	filelist = filelist || [];
	files.forEach(function(file) {
		var stat = fs.lstatSync(dir + file) ;
		if (!stat.isSymbolicLink()) {
			if (stat.isDirectory())
				filelist = walkSync(dir + file + '/', filelist);
			else
				filelist.push(dir+file);
		}
	});
	return filelist;
};

pass = walkSync('.').filter(function(fn){ return fn.match(/\.js$/)}) ;

console.log("Syntax check - "+pass.length+" test files installed....") ;

pass = pass.map(function(fn,idx){
	if (idx && idx%1000==0)
		console.log('Tested '+idx+'...') ;
	var code = fs.readFileSync(fn).toString() ;
	try {
		var r = {name:fn, pass:false, toString:function(){
			return this.name+" pass:"+this.pass+"\nsource:"+this.source+"\ninput :"
				+this.inputs+"\noutput:"+this.output+"\nerror :"+this.error ;
//				+"\nitree "+JSON.stringify(this.itree)+
//				+"\notree "+JSON.stringify(this.otree);
		}} ;
//		r.source = code.replace(/\s+/g," ") ;
		var ci = nodent.prettyPrint(nodent.parse(code,"",null,opts),opts) ;
		r.inputs = ci.code.replace(/\s+/g," ") ;
		r.itree = ci.ast ;
		var co = nodent.prettyPrint(nodent.parse(ci.code,"",null,opts)) ;
		r.output = co.code.replace(/\s+/g," ") ;
		r.otree = co.ast ;
		var eq = eqTree(ci.ast,co.ast) ;
		if (eq && r.inputs==r.output) {
			n += 1 ;
			return {name:fn,pass:true} ;
		} else {
			return r ;
		}
	} catch (ex) {
		r.error = ex.stack ;
		return r ; 
	}
}) ;
if (n===pass.length)
	console.log("Syntax check - pass "+n+" of "+pass.length) ;
else {
	console.log("Syntax check - Errors\n",pass.filter(function(p){ return !p.pass}).join("\n")) ;
	console.log("Syntax check - FAIL "+(pass.length-n)+" of "+pass.length) ;
}

function locations(k) {
	return ['end','start','loc'].indexOf(k)<0 ;
}

function eqTree(a,b,p) {
	if (!p) p = "" ;
	var ka = Object.keys(a).filter(locations).sort() ;
	var kb = Object.keys(b).filter(locations).sort() ;
	if (ka.length != kb.length)
		throw new Error("length("+ka.length+","+kb.length+") "+p) ;

	for (var i=0;i<ka.length;i++)
		if (ka[i] != kb[i] || typeof a[ka[i]] != typeof b[kb[i]])
			throw new Error("key("+ka[i]+","+kb[i]+") "+p) ;

	for (var i=0;i<ka.length;i++)
		if (typeof a[ka[i]] === 'object' && a[ka[i]])
			eqTree(a[ka[i]],b[kb[i]],p+" > "+ka[i]+":"+a[ka[i]].type) ;
	return true ;
}
