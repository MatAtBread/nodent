"use nodent-promises";

module.exports = {
		name: "promises",
		call:async function() {
			return module.exports.name ;
		},
		consume:async function(x) {
			return await x() ;
		}
	}
