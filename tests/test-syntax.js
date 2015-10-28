/* Test parser/output routines, not async transformations */
var nodent = require('../nodent.js')() ;
var fs = require('fs');

var n = 0 ;

/* For each example, read it, parse it, output it, parse it again and check the trees & code strings are the same */

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

var diff = require('./onp/diff') ;

function testFiles(paths,recurse) {
	var pass = [] ;
	paths.forEach(function(fn){
		if (fs.statSync(fn).isDirectory()) {
			walkSync(fn,pass) ;
		} else {
			pass.push(fn) ;
		}
	}) ;
	pass = pass.filter(function(fn){ return fn.match(/\.js$/)}) ;
	
	console.log("Syntax check - "+pass.length+" test files installed....") ;
	
	pass.forEach(function(fn,idx){
		if (idx && idx%1000==0) {
			console.error('Tested '+idx+'. '+(idx-n)+' fails so far...') ;
		}
		var code = fs.readFileSync(fn).toString() ;
		try {
			var r = {name:fn, toString:function(){
				return this.name+": "+(this.error||"")
				+(this.diff?"\n"+this.diff.summary():"")
				+(this.tree?"\n"+this.tree.summary():"") ;
			}} ;
			
			var opts = {parser:{sourceType:'script',allowImportExportEverywhere:true,onComment:null}} ;
			try {
				var ci = nodent.prettyPrint(nodent.parse(code,"",null,opts),opts) ;
			} catch(ex) {
				opts.parser.sourceType = 'module' ;
				ci = nodent.prettyPrint(nodent.parse(code,"",null,opts),opts) ;
			}
			var co = nodent.prettyPrint(nodent.parse(ci.code,"",null,opts)) ;
			r.diff = diff(ci.code,co.code) ;
			eqTree(ci.ast,co.ast) ; 
			if (!r.diff.diff) {
				n += 1 ;
				return {name:fn} ;
			} else {
				console.log(r.error = r.toString()) ;
				return  r ;
			}
		} catch (ex) {
			if (!ci) {
				n += 1 ;
				r.error = "Not valid javascript (ignored "+opts.parser.sourceType+")" ;
			} else {
				r.error = ex.message ;
				if (ci && co && ci.ast && co.ast) {
					var inTree = JSON.stringify(ci.ast,noLocations,2) ;
					var outTree = JSON.stringify(co.ast,noLocations,2) ;
					r.tree = diff(inTree,outTree) ;
				}
			}
			console.log(r.toString()) ;
			return r ; 
		}
	}) ;
	if (n===pass.length)
		console.log("Syntax check - pass "+n+" of "+pass.length) ;
	else if (pass.length<1000) {
		console.log("Syntax check - FAIL "+(pass.length-n)+" of "+pass.length) ;
	}
}

function noLocations(k,v) {
	return locations(k)?v:undefined ;
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

module.exports = {testFiles:testFiles} ;
