Async and Await syntax and usage
======================

The following sections show you how to declare, call and use async functions using the ES7 `async` and `await` keywords, as well as from existing ES6 and ES5 code.

Declaring Async Functions
-------------------------
To declare an asynchronous function, put `async` in front of the definition. `async` is an ES7 keyword. You shouldn't use it as a top level identifier (variable or function name) in ES7 code. This is how it looks:

		async function myFunc(args) {
			body ;
			return expr ;
		}

[_TRY-IT_](http://nodent.mailed.me.uk/#async%20function%20myFunc(args)%20%7B%0A%20%20body%20%3B%0A%20%20return%20expr%20%3B%0A%7D)

(NB: There are other mappings too, like checking for nested functions and try catch blocks, but the essence is demonstrated in the example above).

	async function myFunc(args) {
	 	if (!args)
	 		throw new Error("Missing parameters") ;
	 	return doSomething(args) ;
	}

[_TRY-IT_](http://nodent.mailed.me.uk/#async%20function%20myFunc(args)%20%7B%0A%20%20if%20(!args)%0A%20%20%20%20throw%20new%20Error(%22Missing%20parameters%22)%20%3B%0A%20%20return%20doSomething(args)%20%3B%0A%7D%0A)

Like any function returning a Promise, you invoke the function and use the Promise via code such as:

	myFunc(args).then(function(returnValue){
		-- do something --			// Success! Use returnValue
	}, function(exception) {
		-- do something else 		// Bad! Handle the error
	}) ;

Async invocation
----------------

Thhe ES7 keyword `await` is implemented as a unary prefix operator (in the same kind of place you might find 'typeof' or 'delete', and also before object member definitions). It is this transformation that stops all the crazy indenting that async callbacks generate.

	var result = await myFunc(args) ;
	moreStuff(result) ;

This is transformed into the code:

	return myFunc(args).then(function($await_myFunc$1) {
		var result = $await_myFunc$1 ;
		moreStuff(result) ;
	},$error) ;

[_TRY-IT_](http://nodent.mailed.me.uk/#var%20result%20%3D%20await%20myFunc(args)%20%3B%0AmoreStuff(result)%20%3B%0A)

Awaiting multiple times
-----------------------

A statement or expression can combine multiple async results, for example:

	console.log(await as1(1),await as2("hello")+await as1(3)) ;
[_TRY-IT_](http://nodent.mailed.me.uk/#console.log(await%20as1(1)%2Cawait%20as2(%22hello%22)%2Bawait%20as1(3))%3B)

This is both syntactically and semantically meaningful, but in the current implementation will call the async functions serially (note: the order in which they are invoked is not guaranteed). It might well be more efficient in this case to use the 'map' cover function (see below) to execute all the functions in parallel first, and use the results:

	var nodent = require('nodent')() ;
	var map = nodent.require('map') ;

	// Execute all the async functions at the same time
	mapped = await map([as1(1),as2("hello"),as1(3)]) ;
	// When they're done:
	console.log(mapped[0],mapped[1]+mapped[2]) ;

Most Promise libraries have a function called `Promise.all()`, which is similar to `nodent.map`. `nodent.map` is more flexible in that `Promise.all()` only accepts arrays whereas `map` can map Objects and apply a specific async function to each value in the Array/Object. See below for more details and  examples). Any values passed to `map` that are not Thenable (i.e. Promises or async function calls) are simply passed through unchanged.

Invoking async functions from ES5/6
-----------------------------------

As described above, the return type from an async function is a Promise (or, to be accurate it's whatever type you assign the scoped variable `Promise` - if this is `nodent.Thenable`, then it has a `then()` member, and behaves enough like a Promise to work with Promises/A+-compliant libraries). So, to invoke an `async function` from a normal ES5 script you can use the code:

	// An async function defined somewhere
	async function readFile() { ... }

	// Calling it using ES5 syntax in a non-nodented way
	readFile(filename).then(function(data){
	    ...
	},function(err){
		....
	}) ;

Similarly, you can wait for any Promise with the `await`keyword - i.e. not just functions you defined yourself as `async`:

	// The elasticsearch library returns a Promise if you don't supply a callback
	var resultPromise = elasticsearch.search(query) ;
	console.log(await resultPromise) ;

or just:

	console.log(await elasticsearch.search(query)) ;

Defining async functions from ES5
---------------------------------
Use nodent! And any function returning a Promise (or Thenable) can be used with `await`.

Missing out await
-----------------
Forgetting to put `await` in front of an async call is easy, and usually not what you want - you'll get a Promise. This can be useful though, when you need a reference to an async return value:

```
var fn ;
if (x)
	fn = test(x) ; // 'test' is async - don't await
else
	fn = testDefault() ;	// testDefault is async - don't await

return await fn ;	// Now await for which function fn refers to

```

```
async function f() { return true ; }
	
var x = f() ;	// 'x' = a Promise

// Call x using nodent
try {
	result = await x ;
	...
} catch(error) {
	...
}
	
// or call x from ES5/6
x.then(function(result){
 	...
},function(error){
 	...
}) ;

```
Remember that calling an async function without `await` still runs the functions - you just can't get the return value, _except_ if use are using lazyThenables in -es7 mode.
