var nodent = require('../nodent')() ;
var map = nodent.require('map',{throwOnError:true}) ;
Function.prototype.asAsync = function(){
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
		JSON.parse.asAsync(fs.readFileSync.asAsync('package.json')),
		JSON.parse.asAsync(readFile('package.json')),
		JSON.parse.asAsync(afs.readFile('package.json')),
		JSON.parse.asAsync(await readFile('package.json')),
		JSON.parse.asAsync(await afs.readFile('package.json')),
		JSON.parse.asAsync(await fs.readFileSync.asAsync('package.json')),
		JSON.parse(await readFile('package.json')),
		JSON.parse(await afs.readFile('package.json')),
		JSON.parse(await fs.readFileSync.asAsync('package.json'))
	])).map(function(p){ return p.version }).every(function(v,_,a){ return v===a[0] })) ;
}

module.exports = test ;
//test().then(console.log.bind(console),function(ex){ console.log(ex.stack) });
