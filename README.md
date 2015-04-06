[![NPM](https://nodei.co/npm/nodent.png?downloads=true&downloadRank=true)](https://nodei.co/npm/nodent/)

NoDent
======

NoDent is a small module for Nodejs that implements the JavaScript ES7 keywoards `async` and `await`. These make writing, reading and understanding asynchronous and callback methods more implicit and embedded in the language.

It works by (optionally) transforming JavaScript when it is loaded into Node. The excellent parser and code generator are courtesy of Uglify2 http://lisperator.net/uglifyjs/

Online demo
===========

You can now see what Nodent does to your ES7 code with an online demo at [here](http://nodent.mailed.me.uk). Within the examples in this README, click on [_TRY-IT_](http://nodent.mailed.me.uk) to see the code live.

Basic Use and Syntax
====================
Declare an asynchronous function (one that returns "later").

	async function tellYouLater(sayWhat) {
		// Do something asynchronous and terminal, such as DB access, web access, etc.
		return result ;
	}
[_TRY-IT_](http://nodent.mailed.me.uk/#async%20function%20tellYouLater(sayWhat)%20%7B%0A%20%20%2F%2F%20Do%20something%20asynchronous%20and%20terminal%2C%20such%20as%20DB%20access%2C%20web%20access%2C%20etc.%0A%20%20return%20result%20%3B%0A%7D%0A)

Call an async function:

	result = await tellYouLater("Hi there") ;
[_TRY-IT_](http://nodent.mailed.me.uk/#result%20%3D%20await%20tellYouLater(%22Hi%20there%22)%20%3B)

To use NoDent, you need to:

	require('nodent')() ;

This must take place early in your app, and need only happen once per app - there is no need to require('nodent') in more
than one file, once it is loaded it will process any files ending in ".njs" or containing a

	'use nodent-es7';

directive at the top of a .js file. You can't use the directive, or any other Nodent features in the file that initially require("nodent")(). If necessary, have a simple "loader.js" that includes Nodent and then requires your first Nodented file, or start your app with nodent from the command line:

	./nodent.js myapp.js

That's the basics.

Why Nodent?
===========

* Simple, imperative code style. Avoids callback pyramids in while maintaining 100% compatibility with existing code.
* No dependency on ES6, "harmony"
* No run-time overhead for Promises, Generators or any other feature beyond ES5 - works on most mobile browsers & IE
* No execution framework needed as with traceur or regenerator 
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

Command-Line usage
==================
You can invoke and run a nodented JavaScript file from the command line with:

	nodent.js myNodentedFile.js
	
You can also simply compile and display the output, without running it. This is useful if you want to pre-compile your scripts:

	nodent.js --out myNodentedFile.js

There is no need to use the command line at all if you want to `require('nodent')()` and then require your own scripts as normal.

ES7 and Promises
================
The ES7 proposal for async and await specified not only the syntactic elements `async` and `await` (i.e. where they can be placed), the execution semantics (how they affect flow of execution), but also the types involved. In particular, `async` functions are specified to return a hidden Promise, and await should be followed by an expression that evaluates to a Promise.

Nodent can operate either with of without Promises as this type. The pros and cons are:
* Using promises makes it easy to, in particular, `await` on third-party code that returns a Promise, and create Promises by invoking an async function. The downside is your execution environment must somehow support Promises at run-time. Some browsers have Promises built in (later versions of Chrome and Firefox) as does Node v11. In other environments you must include a third-party implementation of Promises. Promises also make debugging a little more tricky as stepping in and out of async functions will go into your Promise implementation.
* Not using Promises requires no run-time support, is easier to debug (pairs of callbacks are used to enter and exit async functions), but provides no compatibility with Nodent async functions.

To specify that you wish to use Promises, make the first directive in your file:

	"use nodent-promise";

as opposed to:

	"use nodent-es7";

Changing the directive will change the generated ES5 JavaScript code, but nothing else. If you use Promises, you must define the variable `Promise` in any files which declare `async` functions, or define a `global.Promise`. Nodent has a `Thenable` member that implements the bare minimum needed by Nodent. This implementation is NOT a full Promise-compliant type, but defines a constructor that creates a type with a Promise friendly `then()` method. 

Versions of nodent since v1.1.0 also support using generators, in common with traceur, regenerator and the ES7 specification. This requires an ES6-compliant JS engine, and has not been tested in production (although it passes the test suite). Note that using generators is considerably slower that using Promises, which is itself slower than using Nodent Thenables or ES7 mode. (See Testing below). If you wish to experiement with generators, `use nodent-generators`.

Declaring Async Functions
=========================

To declare an asynchronous function, put "async" in front of the definition. "async" is an ES7 keyword. You shouldn't
use it as a top level identifier (variable or function name) in ES7 code. This is how it looks:

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

The reason for using this pattern is to make it easy to chain asynchronous callbacks together - myFunc can
"return" whenever it likes, and can pass the handler functions onto another async function with too much nasty
indenting. It certainly is easier to write than the more "usual" Node style of "function(error,result){...}"
which gets pretty gnarly pretty quickly.

However, as the sample above shows, it's still very "noisy" in code terms - lots of anonymous functions and
functions returning functions. 

Async invocation
================

The other transformation is a shorter call sequence, through the ES7 keyword `await`. In Nodent
it's implemented as a unary prefix operator (in the same kind of place you might find 'typeof' or
'delete'). It is this transformation that stops all the crazy indenting that async callbacks generate.

	var result = await myFunc(args) ;
	moreStuff(result) ;

This is transformed into the code:

	return myFunc(args).then(function($await_myFunc$1) {
		var result = $await_myFunc$1 ;
		moreStuff(result) ;
	},$error) ;

[_TRY-IT_](http://nodent.mailed.me.uk/#var%20result%20%3D%20await%20myFunc(args)%20%3B%0AmoreStuff(result)%20%3B%0A)

Yes, it hides a return statement in your code. If you step line by line, you WON'T hit "moreStuff"
immediately after executing the line, it will be called later, when myFunc invokes your "success" handler.

Awaiting multiple times
-----------------------

A statement or expression can combine multiple async results, for example:

	console.log(await as1(1),await as2("hello")+await as1(3)) ;
[_TRY-IT_](http://nodent.mailed.me.uk/#console.log(await%20as1(1)%2Cawait%20as2(%22hello%22)%2Bawait%20as1(3))%20)

This is both syntactically and semantically meaningful, but in the current implementation will
call the async functions serially (note: the order in which they are invoked is note guaranteed).
It might well be more efficient in this case to use the 'map' cover function (see below) to execute
all the functions in parallel first, and use the results:

	var map = require('nodent')({use:['map']}).map ;
	// Execute all the async functions at the same time
	mapped = await map([as1(1),as2("hello"),as1(3)]) ;
	// When they're done:
	console.log(mapped[0],mapped[1]+mapped[2]) ;

Most Promise libraries have a similar function called `Promise.all()`, which is similar to `nodent.map`, but more flexible in someways (it accepts array members that are NOT Promises), and less in others (it only accepts arrays - `map` can map Objects and apply a specific async function to each value in the Array/Object. See below for more details and  examples). 

async, await and ES5
====================

Invoking async functions from ES5
---------------------------------

As described above, the return type from an async function is a Promise (or, to be accurate it's whatever type you assign the scoped variable `Promise` - if this is `nodent.Thenable`, then it has a `then()` member, and behaves enough like a Promise to work with Promises/A+-compliant libraries). So, to invoke the async function `readFile` you can use the code:

	readFile(filename).then(function(data){
	    ...
	}) ;
	
Similarly, you can wait for any Promise with the Nodent code:

	// The elasticsearch library returns a Promise if you don't supply a callback
	var resultPromise = elasticsearch.index(query) ;
	console.log(await resultPromise) ;
	
or just:

	console.log(await elasticsearch.index(query)) ;

Defining async functions from ES5
---------------------------------
   
Specifically in Nodent (not specified by ES7), you can interface an ES7 async function with a old style callback-based function. For example, to create an async function that sleeps for a bit, you can use the standard setTimeout function:

	async function sleep(t) {
	    setTimeout(function(){
	    	return async t;
	    },t) ;
	} 

This works because Nodent translates this into:

	function sleep(t) {
	    return new Promise(function($return, $error) {
	        setTimeout(function(){
	        		return $return(t) ;
	        },t);
	    });
	}
[_TRY-IT_](http://nodent.mailed.me.uk/#%09async%20function%20sleep(t)%20%7B%0A%09%20%20%20%20setTimeout(%24return)%20%3B%0A%09%7D%20%0A)

Similarly, `throw async <expression>` causes the inner callback to make the container async function throw and exception. The `return async` and `throw async` statements are NOT ES7 standards (see https://github.com/lukehoban/ecmascript-asyncawait/issues/38).
If you want your code to remain compatible with standard ES7 implementations when the arrive, use the second form above, which is what nodent would generate and is therefore ES5 compatible.

Gotchas & ES7 compatibility
===========================

Async programming with Nodent (or ES7) is much easier and simpler to debug than doing it by hand, or even using run-time constructs such as generators and promises, which have a complex implementation of the their own when compiled to ES5. However, a couple of common cases are important to avoid:

Implicit return
---------------
Async functions do NOT have an implicit return - i.e. not using the return keyword at the end of an async function means that the caller will never emerge from the `await`. This is intentional, without this behaviour, it would be difficult to have one async function call another (since the first would eventually return, as well as the second).

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
			return fileItem[x] ;
			
		// Oops! If x==0, do something via a traditional Node callback
		fs.readFile("404.html",function(err,data){
				// The callback is NOT mapped by Nodent - this function 
				// is a standard callback, not an async function
				if (err) throw async err ;
				return async data ;
		}) ;
		// NB: An implicit return here would cause $return() to be invoked twice
		// so exit without doing anything
	}

Conditionals & missing returns
------------------------------
Nodent versions 1.0.11 and earlier required some thought when using conditionals such as switch and if - specifically the "early return" on an awaited expression meant conditional blocks did not "fall-through" into the surroudning block. This has been fixed in 1.0.12 and later. 

Nodent versions prior to 1.0.14 did not meet the ES7 standard for loops: using await in a loop made the loop
block work as expected, but each iteration of the loop was started immediately. As of Nodent v1.0.14
`while(){} do{}while for(;;){}` loops behave as per the ES7 standard (i.e. as if they were synchronous).

The `for (..in..)` construct DOES NOT meet the ES7 standard and is NOT transformed by nodent - each iteration of the loop body is synchronized as expected, but individual iterations may be interleaved and the loop may complete before some or all of the individual keys are enumerated. This behaviour can be ameliorated using the "map" cover (see later).

Missing out await 
-----------------
Forgetting to put `await` in front of an async call is easy. And usually not what you want - you'll get a reference
to a Promise. This can be useful to where else you need a reference to an async function:

	var fn ;
	if (x)
		fn = test(x) ; // 'test' is async
	else
		fn = testDefault() ;	// testDefault is async
	return await fn ;


	async function f() { return true ; }
	var x = f() ;	// 'x' = a Thenable object
	// Call x
	await x ;
	// Call x from ES5
	x.then(function(result){ ... },function(error){ ... }) ;


Function.prototype.toString & arguments
---------------------------------------
Since fn.toString() is a run-time feature of JavaScript, the string you get back is the trans-compiled source, not the original source. This can be useful to see what Nodent did to your code.

The JavaScript arguments value is problematic in async functions as the body of the code is wrapped in another function. This can make implementing variable argument functions difficult. If you must do this either use type-testing of each parameter, or implement your async function 'by hand':

	// Can be 'await'ed like an async function
	function varArgs() {
		var args = arguments ; // Capture the arguments
		return new Promise(function($return,$error) {
			return $return("You passed "+args.length+" parameters") ;
		}) ;
	}

	console.log(await varArgs(8,3,1)) ;
	// Output:
	// You passed 3 parameters

Diffrences from the ES7 specification
-------------------------------------
* Generators and Promises are optional. Nodent works simply by transforming your original source
* As of current version, `finally { }` blocks are NOT transformed by Nodent
* As of current version, `for (...in...)` loops are NOT transformed by Nodent
* The ES7 async-await spec states that you can only use await inside an async function. This generates a warning in nodent, but is permitted.
* Within async functions, `this` is correctly bound automatically. Promises specify that callbacks should be called from global-scope, and if necessary should be explicitly bound, or (preferentially, as I read it) use closures.
* The statements `return async <expression>` and `throw async <expression>` are proposed extensions to the ES7 standard (see https://github.com/lukehoban/ecmascript-asyncawait/issues/38)
* async functions that fall-through (i.e. never encounter a `return` or `throw` (async or otehrwise) do not return. In the ES7 spec, these functions return `undefined` when `await`ed. This behaviour does not permit async functions to be terminated by callbacks. To remain compatible with the ES7 spec, make sure your async functions either return or throw and exception. 

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

The covers to be loaded are in the keys of the "use" option ('http' in the example above) and the configuration for that cover is the key's value ({autoProtocol:true} in the above example). If you already have a reference to nodent, you can require a single cover using:

	var nodent = require('nodent')();
	var http = nodent.require('http');

http(s)
-------
The nodent version of http.get returns a Thenable:

	nodent.http.get(options).then(function(response){},function(error){}) ;

Hopefully you'll recognise this and be able to see you can now invoke it like:

	response = await nodent.http.get(options) ;

To make life even easier, the response is covered too, just before the first callback is invoked with an addition async function called "wait", that waits for a named event. The whole setup is therefore:

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

	// Use nodent.map
	var map = require('nodent')({use:['map']}).map ;

	// Asynchronously map every key in "myObject" by adding 1 to the value of the key
	mapped = await map(myObject,async function(key){
		return myObject[key]+1 ;	// This can be async without issues
	}) ;
	// All done - mapped contains the new object with all the elements "incremeneted"


Example: map an array of URLs to their content

	// Use nodent.map & http
	var nodent = require('nodent')({use:['http','map']}) ;

	mapped = await nodent.map(['www.google.com','www.bbc.co.uk'],async function(value,index){
		// Get the URL body asynchronously.
		body = await nodent.http.getBody("http://"+value) ;
		return body ;
	}) ;
	// All done - mapped is the new array containing the bodies

Example: iterate through a set of integer values and do something asynchronous with each one.

	// Use nodent.map & http
	var nodent = require('nodent')({use:['http','map']}) ;

	mapped = await nodent.map(3,async function(i){
		// Get the URL body asynchronously.
		body = await nodent.http.getBody("http://example.com/cgi?test="+i) ;
		return body ;
	}) ;
	// All done - mapped is the new array containing the bodies

Example: execute arbitrary async functions in parallel and return when they are all complete

	// Use nodent.map
	var nodent = require('nodent')({use:['map']}) ;

	mapped = await nodent.map([asyncFn("abc"),asyncFn2("def")]) ;

	/* All done - mapped is an new array containing the async-return of the first function (at index [0]) and the async-return of the second funcrion (at index [1]). There is no programmatic limit to the number of async functions that can be passed in the array. Note that the functions have no useful parameters (use a closure or wrap the function if necessary). The order of execution is not guaranteed (as with all calls to map), but the completion routine will only be called when all async functions have finished either via a return or exception. */

In the event of an error or exception in the async-mapping function, the error value is substitued in the mapped object or array. This works well since all the exceptions will be instances of the JavaScript Error() type, as they can be easily tested for in the mapped object after completion. The map() function only errors if an async function illegally returns more than once (including multiple errors or both an error and normal response).

nodent.asyncify
---------------
This helper function wraps "normal" Node asynchronous functions (i.e. those whose final paramter is of the form `function(err,data)`)
to make them usuable with `await`. For example, to asyncify the standard Node module 'fs':

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

You can optionally supply your own filter to asyncify. For example to only map a function called 'queryDb':

	var aDB = asyncify(DB,function(name,newObject){
		return name=="queryDb" ;
	}) ;

You can also supply an option third parameter to asyncify() to avoid name-clashes (you often won't need this as asyncify builds a new object with the original as the prototype).

	var afs = asyncify(require('fs',null,"Async") ;
	// Async version of readFile() has "Async" appended
	await afs.readFileAsync("./mydata.txt") ;

Testing
=======

Nodent has a test suite (in ./tests) which is itself a node package. Since it requires a bunch of Promise implementations to test against, it is NOT installed when 'nodent' is installed. If you want to run the tests:

	cd tests
	npm install
	cd ..
	./nodent.js tests
	
	await-usage.js  x2423       nodent-es7,100ms    nodent.Thenable,92%     native,307%     bluebird,187%       rsvp,140%       when,125%       
	complex.js      x294        nodent-es7,100ms    nodent.Thenable,86%     native,186%     bluebird,144%       rsvp,136%       when,123%       
	declarations.js x1908       nodent-es7,100ms    nodent.Thenable,96%     native,165%     bluebird,128%       rsvp,128%       when,124%       
	dowhile.js      x2006       nodent-es7,100ms    nodent.Thenable,100%    native,330%     bluebird,133%       rsvp,122%       when,108%       
	else-if.js      x2086       nodent-es7,100ms    nodent.Thenable,92%     native,380%     bluebird,128%       rsvp,143%       when,151%       
	for-if.js       x2120       nodent-es7,100ms    nodent.Thenable,86%     native,400%     bluebird,164%       rsvp,154%       when,141%       
	for.js          x1814       nodent-es7,100ms    nodent.Thenable,93%     native,273%     bluebird,117%       rsvp,108%       when,111%       
	fs-sync.js      x19         nodent-es7,103ms    nodent.Thenable,92%     native,91%      bluebird,94%        rsvp,149%       when,100%       
	fs.js           x1          nodent-es7,198ms    nodent.Thenable,93%     native,94%      bluebird,110%       rsvp,100%       when,96%    
	if-stmt-map.js  x1101       nodent-es7,100ms    nodent.Thenable,99%     native,194%     bluebird,122%       rsvp,112%       when,113%       
	if-stmt.js      x2136       nodent-es7,100ms    nodent.Thenable,91%     native,379%     bluebird,161%       rsvp,164%       when,138%       
	if-try.js       x1197       nodent-es7,100ms    nodent.Thenable,96%     native,174%     bluebird,147%       rsvp,125%       when,126%       
	inline.js       x2287       nodent-es7,100ms    nodent.Thenable,90%     native,370%     bluebird,163%       rsvp,161%       when,144%       
	method.js       x621        nodent-es7,100ms    nodent.Thenable,107%    native,172%     bluebird,186%       rsvp,145%       when,149%       
	nested-async.js x2788       nodent-es7,100ms    nodent.Thenable,94%     native,197%     bluebird,132%       rsvp,150%       when,147%       
	nested-await.js x3008       nodent-es7,100ms    nodent.Thenable,93%     native,258%     bluebird,141%       rsvp,135%       when,123%       
	optimized.js    x2786       nodent-es7,100ms    nodent.Thenable,80%     native,156%     bluebird,110%       rsvp,98%        when,104%       
	perf-2.js       x1          nodent-es7,181ms    nodent.Thenable,100%    native,200%     bluebird,203%       rsvp,139%       when,140%       
	perf.js         x17         nodent-es7,104ms    nodent.Thenable,137%    native,1361%    bluebird,276%       rsvp,205%       when,268%       
	ret-fn.js       x1813       nodent-es7,101ms    nodent.Thenable,82%     native,193%     bluebird,106%       rsvp,114%       when,98%    
	sleep.js        x1          nodent-es7,293ms    nodent.Thenable,100%    native,100%     bluebird,100%       rsvp,100%       when,100%       
	switch-stmt.js  x2612       nodent-es7,100ms    nodent.Thenable,87%     native,276%     bluebird,137%       rsvp,136%       when,127%       
	sync-await.js   x62         nodent-es7,101ms    nodent.Thenable,99%     native,96%      bluebird,151%       rsvp,72%        when,286%       
	sync-ret.js     x1          nodent-es7,101ms    nodent.Thenable,?,n/a   native,?,n/a    bluebird,?,n/a      rsvp,?,n/a      when,?,n/a      
	try-if.js       x1187       nodent-es7,100ms    nodent.Thenable,98%     native,151%     bluebird,121%       rsvp,116%       when,115%       
	try.js          x521        nodent-es7,100ms    nodent.Thenable,92%     native,179%     bluebird,172%       rsvp,119%       when,117%       
	while.js        x656        nodent-es7,100ms    nodent.Thenable,97%     native,176%     bluebird,160%       rsvp,143%       when,137%       
	
The tests themselves are normal (nodented) JavaScript files invoked with the parameteres require,module and Promise. If you want to add a test, make sure it exports a single async function which the test runner can call. The async return value from this function should be `true` for success and `false` for failure.

If you wish to add a Promise implementation to test against, add it to the dependencies in tests/package.json and give it an entry in the tests/index.js test runner. 

The test runner in tests/index.js accepts the following options:

	./nodent.js tests [--out --save --es7 --generators] tests [test-files]
	
	--out        Show the generated ES5 code for Promises
	--es7        Show the generated ES5 code for ES7 mode
	--save       Save the output (must be used with --out or --es7)
	--quiet      Suppress any errors or warnings
	--quick      Don't target a specific execute time, just run each test once
	--generators Performance test syntax transformation, followed by generators

Changelog
==========

06Apr15: Hoist continuations as Firefox doesn't like forward references 
06Apr15: Implement `return async` and `throw async` for callbacks nested within async functions to replace $return and $error


04Apr15: Correct documentation for "use nodent-promise". In generator mode, bind the generator to the caller's `this` to enable constructs such as `myclass.prototype.fn = async function ... ;`. The ES7 specification is not clear as to whether as to how this construct is exectued (i.e. there is no mechanism for binding the generator to the calling object, but it is syntactically valid).
 
02Apr15: Fix an issue that caused 'if .. else .. ; more' to not continue to 'more' when nested inside a try{} block. Create new test cases to ensure compliance

25Mar15: Fix an issue which caused a `return` within a loop to not exit the enclosing `async` function.
25Mar15: Fix an issue which caused function inlining of non-functional calls to elide the body without updating the references (apparent as an incorrect "Undefined" exception at runtime).

24Mar15: Update the test harness to normalize test times by targetting a completion time of at least 100ms.

22Mar15: Implement transformation to Generator functions. NB: This is experimental and at present underperfoms the normal nodent transformations by about 3 times. Turn on by specifying the compiler option `generators:true`, or `--generators` from the test harness.   

12Mar15: Fix issue in function hoisting that lost references where a named function was part in a statement that was also and expression, for example 'return function x(){}' was mapped to 'function x(){} return ;'. The original symbol is now in place so that it translates to 'function x(){} return x ;'

11Mar15: Update command-line usage with --out option that compiles but doesn't require the specified file. Modify test-runner so that un-installed providers don't cause the test-runner to barf.

10Mar15: Implement 'dumb function' ellision which folds call-sequences generated by nodent such as 'function $1() { return $2() }' into one, un-nested reference.
 
06Mar15: Fix logging (typo in log statement for syntax errors). Show source filename in error messages. Expand test coverage.

05Mar15: A significant internal refractoring avoids some unusual syntax cases that weren't being transformed correctly - specifically some occurances of `if .... else if .... else if`. Additionally, scope was an issue in functions which declared variables/functions after an `await` but referred to them before the `await`. The actual declaration would be nested in a generated callback and the forward reference would then fail. As of v1.0.30, nodent re-orders all declarations before transpliation to ensure this is not possible. The order for all functions is directives,variables,functions,executable code within an individual scope, meaning executable code (including await) cannot refer forwards.

02Mar15: Update covers (http,map,events) to use Thenable API for ES5-invocations

01Mar15: Implement test suite. Update README, move detailed implementation notes to [HowItWorks.md](./HowItWorks.md)

17Feb15: Optimize away any statements in a block after a `return` or `throw`

16Feb15: Implement looping execution semantics (except `for(...in...)`)

15Feb15: Implement online demo. Fix transformations of un-nested conditional blocks such as '...else if ...'

14Feb15: Implement correct return sematics for if...else... and switch. Correctly compile nested `await` expressions of the form x = await f(await g()) ;

11Feb15: Fix case where a throw inside a nested async function is mapped twice - first to "return $error(x)", then to "return $return($error(x))".

09Feb15: Handle cases where nodent covers are used with code compiled for use with Promises. Implement thunking Promise class (nodent.Thenable) that provides the bare minimum Promise API (construction, .then) to be callable within the cover classes.

06Feb15: Implement correct code-lifting for switch. Implement (optional) use of Promises. Fix sourceMap for Chrome 38+. Fix asyncify when an asyncified function is called with insufficient parameters.

30Jan15: Update to support ES7 async and await syntax. The code and examples in this README are for nodent with ES7 extensions. To previous ES5-compatible syntax is described in [README-v0-1-38](./README-v0-1-38.md). This updated version of Nodent is backwards compatible with the earlier ES5 syntax which is enabled with the "use nodent" directive (not "-es7").

06Jan15: Fix error when http is used with autoProtocol option

17Jun14: Announcing ApiPublisher - Nodent for Networks. Call your Nodent async functions from anywhere! [https://www.npmjs.org/package/apipublisher]

02Jun14: Previous release (in Github, not npmjs) was broken in covers/http. Now fixed.

30May14: Extend the "use" option to accept an object whose keys define which covers to load, and pass the key's value when the cover is loaded as configuration options. See 'autoProtocol' below. The previous style for the use option (an array of values) is still accepted and is the same as providing an undefined configuration object to the cover. Covers can also now be specified through an absolute path so you can load your own.

27May14: Show both mapped and unmapped files & positions in stack traces. Can be suppressed with option {dontMapStackTraces:true}

22May14: Added a real world example. See Before and After below

22May14: Update map() to accept an arbitrary set of async functions as an object or array but WITHOUT a callback. The map will execute every function in the array/object before asynchronously returning a mapped object or array.

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

