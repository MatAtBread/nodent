/** 
 * This program is checked with node.js
 */ 

var color, onp = require('./onp.js');
try {
	color = require('colors') ;
} catch (ex) {
	function nop() { return this } ;
	String.prototype.red = nop ;
	String.prototype.green = nop ;
	String.prototype.dim = nop ;
}

module.exports = function(a,b) {
	var diff = new onp.Diff(a,b);
	diff.compose();
//	console.log("editdistance:" + diff.editdistance());
//	console.log("lcs:" + diff.getlcs());
//	console.log("ses");

	var line = "" ;
	var doc = [] ;
	var diffs = [] ;
	var i = 0;
	var ld = -1 ;
	var ses = diff.getses();
	for (i=0;i<ses.length;++i) {
	    if (ses[i].elem=='\n') {
	    	doc.push(line) ;
	    	line = "" ;
	    	continue ;
	    }
	    if (ses[i].t === diff.SES_COMMON) {
	        line += (ses[i].elem.dim);
	    } else if (ses[i].t === diff.SES_DELETE) {
	    	if (ld != doc.length) {
	    		ld = doc.length ;
	    		diffs.push(ld) ;
	    	}
	        line += (ses[i].elem.red);
	    } else if (ses[i].t === diff.SES_ADD) {
	    	if (ld != doc.length) {
	    		ld = doc.length ;
	    		diffs.push(ld) ;
	    	}
	        line += (ses[i].elem.green);
	    }
	}
	if (line)
		doc.push(line) ;
	return {
		diff:ld>=0, 
		toString:function(){ return doc.join('\n') },
		summary:function() {
			return diffs.map(function(n){ 
				return ""+n+": "+doc[n]
			}).join('\n');
		}
	} ;
}
