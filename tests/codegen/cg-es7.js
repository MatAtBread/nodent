'use nodent-es7 {"lazyThenables":true}';

module.exports = {
	name: "es7",
	call:async function() {
		return module.exports.name ;
	},
	consume:async function(x) {
		return await x() ;
	}
}
