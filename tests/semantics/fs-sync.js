var fs = require('../../nodent').asyncify(Promise)(require('fs')) ;

var n = fs.readdirSync('.').length ;

function test(dir) {
	var files ;
	for (var i=0; i<10; i++) {
		files = fs.readdirSync(dir) ;
		for (var j=0; j<files.length; j++) {
			var stat = fs.statSync(dir+"/"+files[j]) ;
		}
	}
	return files.length ;
}

module.exports = async function() {
	return test('.')==n ;
}

