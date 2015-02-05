NoDent
======

NoDent is a small module for Nodejs that extends standard Javascript semantics to make writing, reading and understanding asynchronous and callback methods more implicit and embedded in the language.

It works by (optionally) transforming JavaScript when it is loaded into Node. The excellent parser and code generator are courtesy of Uglify2 http://lisperator.net/uglifyjs/

Basic Use and Syntax
====================
Declare an asynchronous function (one that returns "later").

	async function tellYouLater(sayWhat) {
		// Do something asynchronous and terminal, such as DB access, web access, etc.
		return result ;
	}

Call an async function:

	result = await tellYouLater("Hi there") ;

To use NoDent, you need to:

	require('nodent')() ;

This must take place early in your app, and need only happen once per app - there is no need to require('nodent') in more
than one file, once it is loaded it will process any files ending in ".njs" or containing a

	'use nodent-es7';

directive at the top of a .js file. You can't use the directive, or any other Nodent features in the file that initially require("nodent")(). If necessary, have a simple "loader.js" that includes Nodent and then requires your first Nodented file (either via the ".njs" extension or the "use nodent-es7"; directive), or start your app nodent from the command line:

	./nodent.js myapp.js

That's the basics.

Why Nodent?
===========

* Simple, imperative code style. Avoids callback pyramids in while maintaining 100% compatibility with existing code.
* No dependency on ES6, "harmony"
* No run-time overhead for Promises, Generators or any other feature beyond ES5
* No 'node-gyp' or similar OS platform requirement for threads or fibers
* ES7 async and await on ES5 (most modern browsers and nodejs).
* For more about ES7 async functions and await see:
  *  [http://wiki.ecmascript.org/doku.php?id=strawman:async_functions](http://wiki.ecmascript.org/doku.php?id=strawman:async_functions)
  *  [http://jakearchibald.com/2014/es7-async-functions/](http://jakearchibald.com/2014/es7-async-functions/)
  *  [https://github.com/lukehoban/ecmascript-asyncawait](https://github.com/lukehoban/ecmascript-asyncawait)

How (and why) it works
======================
NoDent carries out transformations on your JavaScript source as it is loaded into Node:
one to declare functions and one to call them (called an "Async Invocation" here). In each
case, normal, JavaScript functions are what are loaded into Node and executed. Node itself
is not modified in anyway.

NoDent is a not a "framework" - there is no runtime JavaScript to include in your project and it does not execute other than at load time to transform your NoDented files into standard JavaScript.

ES7 and Promises
================
The ES7 proposal for async and await specified not only the syntactic elements 'async' and 'await' (i.e. where they can be placed), the execution semantics (how they affect flow of execution), but also the types involved. In particular, 'async' functions are specified to return a hidden Promise, and await should be followed by an expression that evaluates to a Promise.

Nodent can operate either with of without Promises as this type. The pros and cons are:
* Using promises makes it easy to, in particular, 'await' on third-party code that returns a Promise, and create Promises by invoking an async function. The downside is your execution environment must somehow support Promises at run-time. Some browsers have Promises built in (later versions of Chrome and Firefox) as does Node v11. In other environments you must include a third-party implementation of Promises. Promises also make debugging a little more tricky as stepping in and out of async functions will go into your Promise implementation.
* Not using Promises requires no run-time support, is easier to debug (pairs of callbacks are used to enter and exit async functions), but provides no compatibility with Nodent async functions.

To specify that you wish to use Promises, make the first directive in your file:

	"use nodent-promises";

as opposed to:

	"use nodent-es7";

In the examples in this readme, Promises are not used. Changing the directive will change the generated ES5 JavaScript code, but nothing else.

Declaring Async Functions
=========================

The async function definition:

		async function myFunc(args) {
			body ;
			return expr ;
		}

is mapped to:

		function myFunc(args) {
			return function($return,$error) {
				try {
					body ;
					return $return(expr) ;
				} catch (ex) {
					$error(ex) ;
				}
			}
		}

(NB: There are other mappings too, like checking for nested functions and try catch blocks, but the essence is demonstrated in the example above).

Remember, we're simply transforming a syntactic short-cut into a "normal" JS function. Don't be confused by the
$return and $error identifiers (which are configuarble in any case), they're just normal JS identifiers (in fact,
they're functions).

NoDent uses the "funcback" pattern, where a function returns a function that expects two callback arguments,
one to handle the result, and another to handle exceptions (bear with me - it sounds worse than it is). This pattern
is great because async calls can be easily chained with one another, in particular the "onError" callback can often
just be passed straight through to each function in turn as the error callback.

The "funcback" pattern is very similar in concept to Promises, but without the run-time API such as .then(), .reject(), etc.,
which makes it more efficient as there is no object required to represent the state or callbacks.

"funcback" patterned JS looks like the second function above, and is called like this:

	myFunc(args)(function(returnValue){
		-- do something --			// Success! Use returnValue
	}, function(exception) {
		-- do something else 		// Bad! Handle the error
	}) ;

The reason for using this pattern is to make it easy to chain asynchronous callbacks together - myFunc can
"return" whenever it likes, and can pass the handler functions onto another async function with too much nasty
indenting. It certainly is easier to write than the more "usual" Node style of "function(error,result){...}"
which gets pretty gnarly pretty quickly.

However, as the sample above shows, it's still very "noisy" in code terms - lots of anonymous functions and
functions returning functions. Nodent introduces two syntactic constructs to make this pattern readable and
"natural" for all those procedural, synchronous guys out there.

To declare an asynchronous function, put "async" in front of the definition. "async" is an ES7 keyword. You shouldn't
use it as a top level identifier (variable or function name) in ES7 code. This is how it looks:

	async function myFunc(args) {
	 	if (!args)
	 		throw new Error("Missing parameters") ;
	 	return doSomething(args) ;
	}

The ACTUAL function created will be:

	function myFunc(args) {
		return function($return,$error) {
			try {
				if (!args)
					throw new Error("Missing parameters") ;
				return $return(doSomething(args)) ;
			} catch ($except) {
				$error($except) ;
			}
		}.bind(this) ;
	}

This is just a normal JS function, that you can call like:

	myFunc(args)(function(success){...}, function(except){...}) ;

There's no useful synchronous "return" as such (although it is reasonable and easy to implement async
cancellation by returning an object that can be invoked to cancel the async operation). The
result of executing "doSomething" is passed back into "success" in the example above, unless
an exception is thrown, in which case it ends up in the "except" parameter. Note that
although this is designed for asynchronous callbacks, transforming the source doesn't ensure
that. The above example looks pretty synchronous to me, and a few lines like those above
would get pretty messy pretty quickly.

Async invocation
================

The other transformation is a shorter call sequence, through the ES7 keyword 'await'. In Nodent
it's implemented as a unary prefix operator (in the same kind of place you might find 'typeof' or
'delete'). It is this transformation that stops all the crazy indenting that async callbacks generate.

	var result = await myFunc(args) ;
	moreStuff(result) ;

This is transformed into the code:

	return myFunc(args)(function($await_myFunc$1) {
		var result = $await_myFunc$1 ;
		moreStuff(result) ;
	},$error) ;

Yes, it hides a return statement in your code. If you step line by line, you WON'T hit "moreStuff"
immediately after executing the line, it will be called later, when myFunc invokes your "success" handler.

Awaiting multiple times
-----------------------

A statement or expression can combine multiple async results, for example:

	console.log(await as1(1),await as2("hello")+await as1(3)) ;

This is both syntactically and semantically meaningful, but in the current implementation will
call the async functions serially (note: the order in which they are invoked is note guaranteed).
It might well be more efficient in this case to use the 'map' cover function (see below) to execute
all the functions in parallel first, and use the results:

	var map = require('nodent')({use:['map']}).map ;
	// Execute all the async functions at the same time
	mapped = await map([as1(1),as2("hello"),as1(3)]) ;
	// When they're done:
	console.log(mapped[0],mapped[1]+mapped[2]) ;

Return Mapping
==============
The process which transforms "return 123" into "return $return(123)" is called Return Mapping. It
also maps the other kind of returns (exceptions) and handles nested returns. However, there is an
common optimization in synchronous code where one routine returns the result of another, such as:

	return s_other(123) ;	// Synchronous

In Nodent, can do this by typing:

	return await a_other(123) ;	// Asynchronous

The creation of the hidden callback is a small overhead that can be avoided by simply passing the
callbacks to the inner async call:

	return a_other(123)($return,$error) ; 	// Callbacks passed as normal JS call to async-call

You could just return the un-awaited inner call, and the caller uses 'await' to evaluate it.

	return a_other(123) ; 	// Return the reference to the async call

If both caller and callee are async, the problem here is it will be wrapped in another call to $return. To avoid this,
use the "void" keyword in the return:

	return void a_other(123) ; 

Under normal circumstances you won't need to do this, but it can be useful in cases where you need to return
async functions which can be stored and deferred for later invocation.

Exceptions and $error
=====================
Nodent defines a default error handler (as global.$error) which throws an exception. This allows you to catch exceptions for
async functions in the caller, just as you'd expect:

	async function test(x) {
		if (!x)
			throw new Error("Missing parameter") ;
		return x+1 ;
	} ;

	async function testEx() {
		try {
			await test(1) ; // No problem
			await test() ;	// Oops! Missing parameter
			return await test(2) ;
		} catch (ex) {
			console.log(ex) ;	// Print the exception
			return -1 ;			// Swallow it and return -1
		}
	}

	console.log(await testEx()) ;
	/* Outputs:
		[Error: Missing parameter]
		-1
	*/

Chaining Errors
===============
Exceptions and other errors are caught and passed to the "hidden" callback function "$error". The automatic chaining of this
through an async-call path is really useful and one of the reasons Nodent has such a compact syntax. However, sometimes you
need to intercept an error and handle it differently rather than just return it to the call chain, and ultimately throw an exception.

One common use case is invoking an async function with a specialised hander, for example to produce HTTP errors:

	// Call the async function test (above), but pass errors back via HTTP, not exceptions:
	// Instead of 'await test(...)
	test(x)(function(result){
		response.statusCode = 200 ;
		response.end(JSON.stringify(result)) ;
	},function(error){
		response.statusCode = 500 ;
		response.end(JSON.stringify(result)) ;
	}) ;

If x==0, this will pass the exception back over HTTP, and if x!=0, it will pass the result back.

Since "$error" is just a simple parameter to async calls, you can also do this within an async function. This is pretty
easy, but requires the creation of a variable scope block (e.g. a function) which makes it look messy and verbose. To avoid this a hidden Function prototype chain$error() exists to make it quick and simple.

To handle an exception in the async call-chain, simply redefine $error before invoking the async function, for example:

	async function createDBrecord() {
		$error = $error.chain$error(function(ex,chained){
			if (Error.causedBy(ex,"ConstraintViolation")) {
				return $return("Thanks. Already exists.") ;
			} else {
				chained(ex) ;
			}
		}) ;

		var data = await sql("...") ;
		if (data) {
			return data ;
		} else {
			return null ;
		}
	}

In this example, before calling the database function, we redfine $error to intercept any exceptions and modify
behaviour - in this case either calling $return (via the closure) or calling the original error handler (passed as
the final parameter to the overidden $error handler).

Gotchas
=======

Async programming with Nodent is much easier and simpler to debug than doing it by hand, or even using run-time constructs
such as generators and promises, which have a complex implementation of the their own. However, a couple of common cases are
important to avoid:

Implicit return
---------------
Async functions do NOT have an implicit return - i.e. not using the return keyword at the end of an async function means that the caller will never emerge from the 'await'. This is intentional, without this behaviour, it would be difficult to have one async function call another (since the first would eventually return, as well as the second).

	async function test2(x) {
		if (x)
			return x+1 ;
		// Oops! If x==0, we never return!
	}

Provide an explicit return:

	async function test2(x) {
		if (x)
			return x+1 ;
		// Oops! If x==0 either return or throw
		return -1 ;
	}

Intentionally omit the return as we want another function to do it later:

	async function test2(x) {
		if (x)
			return fileIyem[x] ;
		// Oops! If x==0, do something via a traditional Node callback
		fs.readFile("404.html",function(err,data){
				if (err) return $error(err) ;
				return $return(data) ;
		}) ;
		// NB: An implicit return here would cause $return() to be invoked twice
		// so exit without doing anything
	}

Conditionals & missing returns
------------------------------
Becuase async invocation inserts a 'return' into your code (so it can be completed later), the semantics of if/else and loops
need some care:

	function f(x) {
		if (x) {
			await myFunc(1) ;
			console.log("truthy") ;
		}
		return "done" ;
	}

If x is truthy, Nodent returns, and on callback proceeds after the 'await'. In the above case, there is nothing in
the containing block which actually returns. Here's how the compiled function looks:

	function f(x) {
			if (x) {
					// Call myFunc, passing the callback formed between the 'await'
					// and the end of its containing block
					return myFunc(1)(function($await_myFunc$1) {
						console.log("truthy") ;
					}.bind(this), $error);;
			}
			return "done";
	}

On return, "truthy" is output, but then the async call chain is broken - neither $return or $error have been invoked.

To fix this, ensure you have a return (or throw) in all code paths and don't rely on conditional blocks falling through
into their containing block. Full use of if/else makes this explicit:

	function f(x) {
		if (x) {
			await myFunc(1) ;
			console.log("truthy") ;
			// We obviously need to return something here, since there's no implicit return
			return "ok" ;
		} else {
			return "done" ;
		}
	}

For loops, the semantics of nodent do NOT meet the ES7 standard. Using await in a loop makes the loop
block work as expected, but each iteration of the loop is started immediately, whether or not the
contents of the block have returned to the await.

	async function x(y) { await setImmediate ; return y+1 } ;
	
	for (var i=0; i<3; i++) {
		console.log("start "+i) ;
		console.log(await x(i)) ;	
		console.log("end "+i) ;
	}
	console.log("done") ;

Output:

	start 0
	start 1
	start 2
	done
	1
	end 3
	2
	end 3
	3
	end 3

Note that although each iteration works in sequence (start,n,end), all the iterations start synchronously and the
responses can finish in any order. The statement after the loop ("done") is executed as soon as all the iterations are
started. Nodent prints a warning when you use await inside a loop liek this as the behaviour is non-standard.

Missing await, async function references & Promises
---------------------------------------------------
Forgetting to put 'await' in front of an async call is easy. And usually not what you want - you'll get a reference
to the inner 'function($return,$error)'. However, this can be useful to help out with the above conditional/return problem, or
anywhere else you need a reference to an async function.

	var fn ;
	if (x)
		fn = test(x) ; // 'test' is async
	else
		fn = testDefault() ;	// testDefault is async
	return await fn ;

As discussed at the beginning, the type funcback signature means that the un-awaited return from an async 
function is directly compatible with Promises, so that you can pass them into the Promise constructor:

	async function myFunc(arg) {
		// ...
	} 

	var p = new Promise(myFunc(100)) ;
	p.then(...);

Nodent async functions don't themselves require Promises - their use if entirely optional.

Function.prototype.toString & arguments
---------------------------------------
Since fn.toString() is a run-time feature of JavaScript, the string you get back is the trans-compiled source,
not the original source. This can be useful to see what Nodent did to your code.

The JavaScript arguments value is problematic in async functions. Typically you will only ever see two
values - $return and $error. This can make implementing variable argument functions difficult. If you must do this either
use type-testing of each parameter, or implement your async function 'by hand':

	// Can be 'await'ed like an async function
	function varArgs() {
		var args = arguments ; // Capture the arguments
		return function($return,$error) {
			return $return("You passed "+args.length+" parameters") ;
		}
	}

	console.log(await varArgs(8,3,1)) ;
	// Output:
	// You passed 3 parameters


Auto-parse from Nodejs
======================
The exported function generateRequestHandler(path, matchRegex, options) creates a node/connect/express compatible function for handling requests for nodent-syntax files that are then parsed and served for use within a stanadrd browser environment, complete with a source map for easy debugging.

For example, with connect:

	var nodent = require('nodent')() ;
	...
	var app = connect() ;
	...
	app.use(nodent.generateRequestHandler("./static-files/web", 	// Path to where the files are located,
		/\.njs$/,	// Parse & compiles ending in ".njs"
		{})) ;	// Options (none)

The regex can be omitted, in which case it has the value above.

The currently supported options are:

	enableCache: <boolean>		// Caches the compiled output in memory for speedy serving.
	setHeaders: function(response) {}	// Called prior to outputting compiled code to allow for headers (e.g. cache settings) to be sent

Built-in conversions & helpers
==============================

Nodentify has a (small but possibly growing) set of covers for common Node modules. You specify these through the parameter when requiring nodent:

	require('nodent')({use:['http']}) ;

Nodent will require and instantiate the http library for you and attach it to the return, so you can say:

	var http = require('nodent')({use:['http']}).http ;

Some covers can accept a configuation object, in this case specify the options as a nested object:

	var http = require('nodent')({use:{http:{autoProtocol:true}}}).http ;

The covers to be loaded are in the keys of the "use" option ('http' in the example above) and the configuration for that cover is the key's value ({autoProtocol:true} in the above example).

http(s)
-------
The nodent version of http.get has JS "funcback" the signature:

	nodent.http.get(options)(function(response){},function(error){}) ;

Hopefully you'll recognise this and be able to see you can now invoke it like:

	response = await nodent.http.get(options) ;

To make life even easier, the response is covered too, just before the first callback is invoked with an addition "funcback" called "wait", that waits for a named event. The whole setup is therefore:

	var http = require('nodent')({use:['http']}).http ;

	/* Make a request. Nodent creates the callbacks, etc. for you
	and so you can read the line as "wait for the response to be generated" */
	var response = await http.get("http://npmjs.org/~matatbread") ;

	var body = "" ;
	response.on('data',function(chunk){ body += chunk ;} ;

	/* Wait for the "end" event */
	await response.wait('end') ;

	/* The response is complete, print it out */
	console.log('The response is:\n"+body) ;

http.request is similar, but not identical as you will need access to the request object to end it (amongst other things):

	var req = await http.request(options) ;
	req.end() ;	 // Do whatever you need to with the request
	// Wait for the "response" event
	var response = await req.wait('response') ;
	var body = "" ;
	response.on('data',function(chunk){ body += chunk ;} ;
	// Wait for the response to be completed
	await response.wait('end') ;
	console.log('The response is:\n"+body) ;

The convenience function http.getBody(options) asynchronously gets a body encoded in UTF-8:

	console.log('The response is:",
		await http.getBody("http://www.example.com/something")) ;

The "http" cover (not https) can accept a single configuration option 'autoProtocol' that makes get(), request() and getBody() examine the passed url string or URL and use either http or https automatically. The default is "false", meaning request URLs via https will fail with a protocol mismatch.

"map"
-----
The nodent cover "map" works like an aynchronous, parallel object/array mapper, similar to Array.prototype.map(). The map function takes three parameters: the entity to iterate over, optionally an object in which to place the results (they are returned from the async map in any case), and the async function to call on each iteration.

The function completes when all the aync-iteration function calls have completed (via a return or exception). The order of execution of each async function is not guarenteed. When complete, the async-return is a complementary object or array containing the mapped values as return asynchronously. If present, the return values are placed into the optional second parameter. If omitted, a new object or array is created to hold the results. The initial argument (the entity to iterate over) can be either:

* An Object - each field is passed to the async-iterator function
* An Array - each element is passed to the async-iterator function
* A single Number - the async function is invoked with the integer values 0 to Number-1
* An array or Object of async functions - each function in the array is invoked asynchronously. In this case the third parameter must be omitted.

Example: mapping an object

	// Use nodent.async
	var async = require('nodent')({use:['async']}).async ;

	// Asynchronously map every key in "myObject" by adding 1 to the value of the key
	mapped = await async.map(myObject,async function(key){
		return myObject[key]+1 ;	// This can be async without issues
	}) ;
	// All done - mapped contains the new object with all the elements "incremeneted"


Example: map an array of URLs to their content

	// Use nodent.async & http
	var nodent = require('nodent')({use:['http','async']}) ;

	mapped = await nodent.async.map(['www.google.com','www.bbc.co.uk'],async function(value,index){
		// Get the URL body asynchronously.
		body = await nodent.http.getBody("http://"+value) ;
		return body ;
	}) ;
	// All done - mapped is the new array containing the bodies

Example: iterate through a set of integer values and do something asynchronous with each one.

	// Use nodent.async & http
	var nodent = require('nodent')({use:['http','async']}) ;

	mapped = await nodent.async.map(3,async function(i){
		// Get the URL body asynchronously.
		body = await nodent.http.getBody("http://example.com/cgi?test="+i) ;
		return body ;
	}) ;
	// All done - mapped is the new array containing the bodies

Example: execute arbitrary async functions in parallel and return when they are all complete

	// Use nodent.async
	var nodent = require('nodent')({use:['async']}) ;

	mapped = await nodent.async.map([asyncFn("abc"),asyncFn2("def")]) ;

	/* All done - mapped is an new array containing the async-return of the first function (at index [0]) and the async-return of the second funcrion (at index [1]). There is no programmatic limit to the number of async functions that can be passed in the array. Note that the functions have no useful parameters (use a closure or wrap the function if necessary). The order of execution is not guaranteed (as with all calls to async.map), but the completion routine will only be called when all async functions have finished either via a return or exception. */

In the event of an error or exception in the async-mapping function, the error value is substitued in the mapped object or array. This works well since all the exceptions will be instances of the JavaScript Error() type, as they can be easily tested for in the mapped object after completion. The async.map() function only errors if an async function illegal returns more than once (including multiple errors or both an error and normal response).

Function arguments
------------------
Because the async invocation operator maps to the sequence with an embedded function call, it can be used to invoke functions that
accept function arguments with no mapping layer. A good example is "process.nextTick()" or "setImmediate()". These exepct a single function argument which is called by the Node event loop next time around. Using NoDent, you can invoke this functionality very easily:

	doItNow() ;
	await process.nextTick ;
	doItABitLater();
	await setImmediate ;
	doItLaterStill() ;

nodent.asyncify
---------------
This helper function wraps "normal" Node asynchronous functions (i.e. those whose final paramter is of the form `function(err,data)`)
to make them usuable with 'await'. For example, to asyncify the standard Node module 'fs':

	// Require 'fs'
	var fs = require('fs') ;
	// Get a reference to nodent.asyncify
	var asyncify = require('../nodent').asyncify ;
	// Asyncify 'fs'
	var afs = asyncify(fs) ;
	console.log((await afs.readFile("./test/a.js")).toString()) ;

By default, asyncify creates an object that has it's ancestor as its prototype with functions members mapped to the await call signature.
Internally, asyncify filters these so that only functions that don't end in 'Sync' and that have a member named the same without 'Sync'. 
For 'fs', this works (readFile does not end in Sync, and so is mapped, readFileSync ends in 'Sync' and a member called 'readFile' exists).

You can supply your own filter to asyncify. For example to only map a function called 'queryDb':

	var aDB = asyncify(DB,function(name,newObject){
		return name=="queryDb" ;
	}) ;

Before and After
================

Here's an example from a real-world application. We find the NoDent-style code much easier to write, maintain, train new people on and debug than the JS callback-style code, mainly becuase of the large amount of anonymous function "glue" and the like which kind of hides the logic away. Anyway, take your choice. You can, of course, see your own code before and after  mapping, live, in node-inspector if you enable source-mapping.

Original code, as supplied to Node:

	clientApi.shareProduct = async function(type,prod,message,img,networks){
		// Create a link that when clicked on can resolve into
		// a (current-user, product) tuple, and which can generate
		// an affiliation link that itself identified the clicker
		// as well as the clickee tuple.

		messasge = message.trim() ;
		var offer = await createOffer(this.request.session.nid,type,prod,message,img,networks) ;

		sysEvent && sysEvent.emit('offer') ;
		if (!offer || !offer.p.resolved)
			throw new Error("Product not fully resolved") ;

		// Now post this offer on FB and/or twitter
		var user = offer.u ;

		var done = await nodent.map(offer.offer.networks,async function(net){
			var posting = await Networks.get(net).postStatus({
				id:user[net+"-id"],
				token:user[net+"-token"],
				secret:user[net+"-secret"],
				user:user
			},message,offer.offer,false) ;
			return posting ;
		}) ;

		var updated = await offer.offer.update({status:done}) ;
		offer.offer = updated ;

		for (var i=0; i<done.length; i++) {
			if (done[i] instanceof AuthError) {
				done[i].message = "You need to authorise posting on "+done[i].authRequired ;
				throw done[i] ;
			} else if (done[i] instanceof Error) {
				throw done[i] ;
			}
		}

		notify.send(user,{why:"OFFERS"},offer.offer) ;
		return offer ;
	};

Code after cross-compilation by Nodent and as execute by Node:

	clientApi.shareProduct[1] = function(type, prod, message, img, networks) {
	    return function($return, $error) {
        	try {
        	    // Create a link that when clicked on can resolve into
        	    // a (current-user, product) tuple, and which can generate
        	    // an affiliation link that itself identified the clicker
        	    // as well as the clickee tuple.
        	    messasge = message.trim();
        	    return createOffer(this.request.session.nid, type, prod, message, img, networks)(function(offer) {
        	        sysEvent && sysEvent.emit("offer");
        	        if (!offer || !offer.p.resolved) {
        	            return $error(new Error("Product not fully resolved"));
        	        }
        	        // Now post this offer on FB and/or twitter
        	        var user = offer.u;
        	        return nodent.map(offer.offer.networks, function(net) {
        	            return function($return, $error) {
        	                try {
        	                    return Networks.get(net).postStatus({
        	                        id: user[net + "-id"],
        	                        token: user[net + "-token"],
        	                        secret: user[net + "-secret"],
        	                        user: user
        	                    }, message, offer.offer, false)(function(posting) {
        	                        return $return(posting);
        	                    }.bind(this), $error);;
        	                } catch ($except) {
        	                    $error($except)
        	                }
        	            }.bind(this);
        	        })(function(done) {
        	            return offer.offer.update({
        	                status: done
        	            })(function(updated) {
        	                offer.offer = updated;
        	                for (var i = 0; i < done.length; i++) {
        	                    if (done[i] instanceof AuthError) {
        	                        done[i].message = "You need to authorise postinf on " + done[i].authRequired;
        	                        return $error(done[i]);
        	                    } else {
        	                        if (done[i] instanceof Error) {
        	                            return $error(done[i]);
        	                        }
        	                    }
        	                }
        	                notify.send(user, {
        	                    why: "OFFERS"
        	                }, offer.offer);
        	                return $return(offer);
        	            }.bind(this), $error);;
        	        }.bind(this), $error);;
        	    }.bind(this), $error);;
        	} catch ($except) {
        	    $error($except)
        	}
	    }.bind(this);
	};

Changelog
==========

30Jan15: Update to support ES7 async and await syntax. The code and examples in this README are for nodent with ES7 extensions. To previous ES5-compatible syntax is described in [README-v0-1-38](./README-v0-1-38.md). This updated version of Nodent is backwards compatible with the earlier ES5 syntax which is enabled with the "use nodent" directive (not "-es7").

06Jan15: Fix error when http is used with autoProtocol option

17Jun14: Announcing ApiPublisher - Nodent for Networks. Call your Nodent async functions from anywhere! [https://www.npmjs.org/package/apipublisher]

02Jun14: Previous release (in Github, not npmjs) was broken in covers/http. Now fixed.

30May14: Extend the "use" option to accept an object whose keys define which covers to load, and pass the key's value when the cover is loaded as configuration options. See 'autoProtocol' below. The previous style for the use option (an array of values) is still accepted and is the same as providing an undefined configuration object to the cover. Covers can also now be specified through an absolute path so you can load your own.

27May14: Show both mapped and unmapped files & positions in stack traces. Can be suppressed with option {dontMapStackTraces:true}

22May14: Added a real world example. See Before and After below

22May14: Update async.map() to accepts an arbitrary set of async functions as an object or array but WITHOUT a callback. The map will execute every function in the array/object before asynchronously returning a mapped object or array.

09Apr14: Update async.map() to accept a Number as the first argument. The async-callback is then called with integers from 0 to arg-1 rather than object keys or array elements.

26Mar14: Catch parsing errors in generateRequestHandler() and return them as HTTP errors

24Mar14: Add support for gzip,deflate in http.getBody

18Mar14: Add nodent.generateRequestHandler(path,regex,options). This returns a node request handler that is connect/express compatible that automatically parses a file-based nodent-syntax file into a standard, JS file suitable for use in a browser, complete with a source-map for easy debugging.

12Mar14: Add prototype to allow error handlers to be chained. See "Chaining errors" below.

10Feb14: Add convenience method http[s].getBody(url) - open, read and return a UTF-8 encoded response as a fully buffered string.

02Feb14: Make compile() log friendly error messages and throw an object of type Error if there is a problem parsing

31Jan14: Enforce wrapping of $error() values in a native JS "Error" if they are not already done so. To return "non-error" values, use "return", not "throw"

30Jan14: Add nodent.compile() to provide a one-step cross compilation. Expose optional "sourceMapping" parameter to allow for a server-side installation to cross-compile client-side JS on the fly

04Jan14: Addition of "async" cover providing async object/array mapping facilities.

29Nov13: Handle the case where we want to chain async functions. See "Return Mapping" below.

27Nov13: Change from delegation to prototype inheritance to expose un-nodented http/http functions. Add warning about duplicate augmentation of EventEmitter.wait()

25Nov13: Added support for Source Maps to allow for NoDentJS debugging. At present, it seems impossible to enable it for both Node and Web use (although for web use, it would be much more efficient to pre-compile the files) so it it named for Node. In the node-inspector debug session, each processed file will appear twice: under it's usual name as NoDent source, and also under "xxx.js.nodent" which is the compiled output. Take care stepping as the node-inspector "step over" does not skip to the next line in the file, but the next executable statement, which is not the same thing in a nodent source file.

21Nov13: NoDent is currently actively developing and in use in a commercial project. The API & Syntax are stable, but not entirely frozen. If you wish to build it is recommended you build against a specific major.minor version.

