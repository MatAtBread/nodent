"use nodent-generators";

module.exports = {
	name: "generators",
	call:async function() {
		return module.exports.name ;
	},
	consume:async function(x) {
		return await x() ;
	}
}
