"use nodent-promises";

var Promise = global.Promise || require('../../nodent').Thenable ;

module.exports = {
		name: "promises",
		call:async function() {
			return module.exports.name ;
		},
		consume:async function(x) {
			return await x() ;
		}
	}
