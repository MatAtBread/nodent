'use strict';

function isThenable(obj) {
	return (obj instanceof Object) && ('then' in obj) && typeof obj.then==="function";
}

module.exports = isThenable;
