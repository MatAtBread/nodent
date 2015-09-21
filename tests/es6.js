"use nodent-es7";
"use strict";

/* ES6 syntax test - ensure ES6 constructs are passed through unmolested */

class TestClass extends Object {
	constructor() {
		super();
		this.id = true;
	}
	update() {
		return super.toString();
	}
	get x() {
		return this.id;
	}
	set x(y) {
		this.id = y;
	}
	static def(a) {
		var q = new TestClass();
		q.x = a ;
		return q ;
	}
}

module.exports = async function() {
	// Arrow
	var handler = ['a','b','c'].map(l => l+"-").join("") ;

	// Object Literals
	var obj = {
		    // __proto__
//		    __proto__: theProtoObj,
		    // Shorthand for ‘handler: handler’
		    handler,
		    // Methods
		    /*toString() {
		     // Super calls
		     return "d " + super.toString();
		    },*/
		    // Computed (dynamic) property names
		    [ 'prop_' + (() => 42)() ]: 42,
		    "class":TestClass.def(88)
		};	
//	console.log(obj) ;
	return true ;
}