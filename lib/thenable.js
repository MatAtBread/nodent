'use strict';

function Thenable(thenable) {
	return thenable.then = thenable ;
};
Thenable.resolve = function(v){
	return ((v instanceof Object) && ('then' in v) && typeof v.then==="function")?v:{then:function(resolve){return resolve(v)}};
};

module.exports = Thenable;
