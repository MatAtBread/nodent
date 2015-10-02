var nodent = require('../nodent')() ;
var map = nodent.require('map',{throwOnError:true}) ;

Function.prototype.async = function(){
	var fn = this ;
	var args = Array.prototype.slice.call(arguments) ;
	return nodent.Thenable(function(ok,err){
		ok(fn.apply(this,await map(args))) ;
	}) ;
}

var fs = require('fs') ;
var afs = fs.asyncify() ;
var readFile = fs.readFile.bind(fs).noDentify(1,0) ;

async function test() {
	return ((await map([
		JSON.parse(fs.readFileSync('package.json')),
		JSON.parse.async(fs.readFileSync.async('package.json')),
		JSON.parse.async(readFile('package.json')),
		JSON.parse.async(afs.readFile('package.json')),
		JSON.parse.async(await readFile('package.json')),
		JSON.parse.async(await afs.readFile('package.json')),
		JSON.parse.async(await fs.readFileSync.async('package.json')),
		JSON.parse(await readFile('package.json')),
		JSON.parse(await afs.readFile('package.json')),
		JSON.parse(await fs.readFileSync.async('package.json'))
	])).map(function(p){ return p.version }).every(function(v,_,a){ return v===a[0] })) ;
}

module.exports = test ;
//test().then(console.log.bind(console),function(ex){ console.log(ex.stack) });
