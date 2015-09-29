[![NPM](https://nodei.co/npm/nodent.png?downloads=true&downloadRank=true)](https://nodei.co/npm/nodent/)

NoDent
======

NoDent is a small module for Nodejs that implements the JavaScript ES7 keywoards `async` and `await`. These make writing, reading and understanding asynchronous and callback methods more implicit and embedded in the language.

It works by (optionally) transforming JavaScript when it is loaded into Node. 

This README assumes you're using Nodent v2.x.x - see the Changelog if your upgrading from an earlier version.

Online demo
===========

You can now see what Nodent does to your JS code with an online demo at [here](http://nodent.mailed.me.uk). Within the examples in this README, click on [_TRY-IT_](http://nodent.mailed.me.uk) to see the code live.

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

This must take place early in your app, and need only happen once per app - there is no need to `require('nodent')` in more than one file, once it is loaded it will process any files ending in ".njs" or containing a `use nodent...` directive at the top of a .js file. 

You can't use the directive, or any other Nodent features in the file that initially require("nodent")(). If necessary, have a simple "loader.js" that includes Nodent and then requires your first Nodented file, or start your app with nodent from the command line:

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

Installation
======================

	npm install --save nodent

Command-Line usage
==================
You can invoke and run a nodented JavaScript file from the command line with:

	nodent.js myNodentedFile.js
	
You can also simply compile and display the output, without running it. This is useful if you want to pre-compile your scripts:

	nodent.js --out myNodentedFile.js

If you are using nodent as part of a toolchain with another compiler, you can output the ES5 or ES6 AST is ESTree format:

	nodent.js --ast myNodentedFile.js
	
To generate a source-map from the command line, precede the output option (if you're using one) with `--sourcemap`. Note: the order of the command line options is significant.

	nodent.js --sourcemap --out myNodentedFile.js

The testing options `--parseast` and `--minast` output the source as parsed into the AST, before transformation and the minimal AST (without position information) respectively.

Use within your Node scripts
============================
There is no need to use the command line at all if you want to do is use `async` and `await` in your own scripts then just  `require('nodent')()`. Files are transformed if they have a `use nodent-...` directive at the top, or have the extension ".njs".

ES7 and Promises
----------------
Nodent can generate code that implements `async` and `await` using basic ES5 JavaScript, Promises (via a third party library or module, or an ES5+/6 platform) or Generators (ES6). Using the one of directives:

	"use nodent-promises";
	"use nodent-es7";
	"use nodent-generators";

The ES7 proposal for async and await specifies the syntactic elements `async` and `await` (i.e. where they can be placed), the execution semantics (how they affect flow of execution), but also the types involved. In particular, `async` functions are specified to return a hidden Promise, and await should be followed by an expression that evaluates to a Promise. The proposal also contains an implementation based on generators.

### Which one should you use?
All the implementations work with each other - you can mix and match.

#### Shipping a self-contained app to a browser or other unknown environment
`use nodent-es7` - it's the most compatible as it doesn't require any platform support such as Promises or Generators, and works on a wide range of desktop and mobile browsers.

#### Shipping a self-contained app within Node
`use nodent-es7` - it's the most compatible as it doesn't require any platform support such as Promises or Generators, but can consume Promises returned by other modules (via `await`) and provide Thenables as well (via `async`). `use nodent-promises` is also a good choice, and if you don't want to import a full Promise implementation you can set `var Promise = require('nodent').Thenable` immediately after the directive. Node v0.12 and later have a native Promise implementation which works, but is a bit slow.

#### Shipping a module within Node, npm or similar
`use nodent-promises` provides the most compatibility between modules and apps. You should install a Promise library (e.g. rsvp, when, bluebird) or use `nodent.Thenable` to expose the Promise API.

#### Generators
`use nodent-generators` provides code which is reasonably easy to follow, but is best not used for anything beyond experimentation as it requires an advanced browser on the client-side, or Node v4.x.x (which has compatibility issues with some popular libraries) and the performance and memory overhead of generators is poor - currently averaging 3 or 4 times slower.

Use within a browser
====================

You can use `async` and `await` within a browser by auto-parsing your scripts when Nodejs serves them to your clients.

The exported function `generateRequestHandler(path, matchRegex, options)` creates a node/connect/express compatible function for handling requests for nodent-syntax files that are then parsed and served for use within a stanadrd browser environment, complete with a source map for easy debugging.

For example, with connect:

	var nodent = require('nodent')() ;
	...
	var app = connect() ;
	...
	app.use(nodent.generateRequestHandler(
		"./static-files/web",	// Path to where the files are located
		/\.njs$/,				// Only parse & compiles ending in ".njs"
		options					// Options (see below)
	)) ;	

The regex can be omitted, in which case it has the value above.

The currently supported options are:

	enableCache: <boolean>		// Caches the compiled output in memory for speedy serving.
	runtime: <boolean>			// Set to precede the compiled code with the runtime support required by Nodent
	extensions: <string-array>	// A set of file extensions to append if the specified URL path does not exist.
	htmlScriptRegex: <optional regex> // If present, Nodent will attempt to read and parse <script> tags within HTML files matching the specified regex
	compiler:{					// Options for the code generator
		es7:<boolean>,			// Compile in es7 mode (if no 'use nodent-' directive is present)
		promises:<boolean>,		// Compile in Promises mode (if no 'use nodent-' directive is present)
		generator:<boolean>,	// Compile in generator mode (if no 'use nodent-' directive is present)
		sourcemap:<boolean>		// Create a sourcemap for the browser's debugger
	}
	setHeaders: function(response) {}	// Called prior to outputting compiled code to allow for headers (e.g. cache settings) to be sent

Note that parsing of script tags within HTML is relatively simple - the parsing is based on regex and is therefore easily confused by JS strings that contain the text 'script', or malformed/nested tags. Ensure you are parsing accurate HTML to avoid these errors. Scripts inline in HTML do not support source-mapping at present.

The runtime routine that should be defined on the Function.prototype in the execution environment provides compatability with Promises and is required. You see either include it in a cross-compiled file with the `runtime:true` option (above), or serve it directly from your Node application with `nodent.$asyncbind.toString()`, or for use with generators (probably not a good idea in a browser as support is limited and slow), `nodent.$asyncspawn.toString()`.

If you call an async function from a non-async function, you need to provide a globally accessible error handler, for example 

	// Called when an async function throws an exception during asynchronous operations
	// and the calling synchronous function has returned.
	window.$error = function(exception) { 
		/* Maybe log the error somewhere */ 
		throw ex ; 
	};

Further information on using Nodent in the browser can be found at https://github.com/MatAtBread/nodent/issues/2

Async/Await syntax
==================

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

This is both syntactically and semantically meaningful, but in the current implementation will call the async functions serially (note: the order in which they are invoked is note guaranteed).
It might well be more efficient in this case to use the 'map' cover function (see below) to execute all the functions in parallel first, and use the results:

	var nodent = require('nodent')() ;
	var map = nodent.require('map') ;
	// Execute all the async functions at the same time
	mapped = await map([as1(1),as2("hello"),as1(3)]) ;
	// When they're done:
	console.log(mapped[0],mapped[1]+mapped[2]) ;

Most Promise libraries have a similar function called `Promise.all()`, which is similar to `nodent.map`. `nodent.map` is more flexible in that `Promise.all()` only accepts arrays whereas `map` can map Objects and apply a specific async function to each value in the Array/Object. See below for more details and  examples). As of nodent v1.2.1, any values passed to `map` that are not Thenable (i.e. Promises or async function calls) are simply passed through unchanged.

async, await and ES5/6
======================

Invoking async functions from ES5/6
-----------------------------------

As described above, the return type from an async function is a Promise (or, to be accurate it's whatever type you assign the scoped variable `Promise` - if this is `nodent.Thenable`, then it has a `then()` member, and behaves enough like a Promise to work with Promises/A+-compliant libraries). So, to invoke the async function `readFile` from a normal ES5 script you can use the code:

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
Use nodent! Any function returning a Promise (or Thenable) can be used with `await`.

Gotchas & ES7 compatibility
===========================

Async programming with Nodent (or ES7) is much easier and simpler to debug than doing it by hand, or even using run-time constructs such as Promises, which have a complex implementation of the their own when compiled to ES5. However, a couple of common cases are important to avoid:

Returning async functions from callbacks
----------------------------------------

Specifically in Nodent (not specified by ES7), you can interface an ES7 async function with a old style callback-based function. For example, to create an async function that sleeps for a bit, you can use the standard setTimeout function, and in its callback use the form `return async <expression>` to not only return from the callback, but also the surrounding async function:

	async function sleep(t) {
	    setTimeout(function(){
	    	// NB: "return async" and "throw async" are NOT ES7 standard syntax
	    	return async undefined;
	    },t) ;
	} 

This works because Nodent translates this into:

	function sleep(t) {
	    return new Promise(function($return, $error) {
	        setTimeout(function(){
	        		return $return(undefined) ;
	        },t);
	    });
	}
[_TRY-IT_](http://nodent.mailed.me.uk/#async%20function%20sleep(t)%20%7B%0A%20%20%20%20setTimeout(function()%7B%0A%20%20%20%20%20%20%20%20%2F%2F%20NB%3A%20%22return%20async%22%20and%20%22throw%20async%22%20are%20NOT%20ES7%20standard%20syntax%0A%20%20%20%20%20%20%20%20return%20async%20undefined%3B%0A%20%20%20%20%7D%2Ct)%20%3B%0A%7D%20)

Similarly, `throw async <expression>` causes the inner callback to make the container async function throw and exception. The `return async` and `throw async` statements are NOT ES7 standards (see [https://github.com/tc39/ecmascript-asyncawait/issues/38](https://github.com/tc39/ecmascript-asyncawait/issues/38)). If you want your code to remain compatible with standard ES7 implementations when the arrive, use the second form above, which is what nodent would generate and is therefore ES5 compatible.

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
		// NB: An implicit return here would cause two returns to be invoked
		// so exit without doing anything
	}

Loops & Conditionals
--------------------
The `for (..in..)` and `for (..of..)`  constructs are NOT transformed by nodent - each iteration of the loop body is synchronized as expected, but individual iterations may be interleaved and the loop may complete before some or all of the individual keys are enumerated. This behaviour can be ameliorated using the "map" cover (see later).

Conditional execution operators (`||` `&&` and `?:`) in nodent always execute on the result of awaits, and do not evaluate them sequentially. Nodent generates a warning when it sees these expressions. The generator implementation (include the standard specification) evaluates in strict synchronous order, so the expressions

	await abc() && await def()
	
...will execute def() ONLY if abc() was true in the generator implementation, whereas the -es7/promise code will execute BOTH abc() and def(), and return the correct result.

To remain compatible with all implementations, it would probably be wise to break these expressions into separate statements, e.g.:

	var expr = await abc() ;			// Always wait for abc()
	if (expr) expr = await def() ;	// Then if it is true, wait for def()

Missing out await 
-----------------
Forgetting to put `await` in front of an async call is easy. And usually not what you want - you'll get a reference
to a Promise. This can be useful though, when you need a reference to an async function:

	var fn ;
	if (x)
		fn = test(x) ; // 'test' is async - don't await
	else
		fn = testDefault() ;	// testDefault is async - don't await
		
	return await fn ;	// Now await for which function fn refers to


	async function f() { return true ; }
	var x = f() ;	// 'x' = a Thenable object

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

Function.prototype.toString & arguments
---------------------------------------
Since fn.toString() is a run-time feature of JavaScript, the string you get back is the trans-compiled source, not the original source. This can be useful to see what Nodent did to your code.

async getters() and setters()
-----------------------------
The parsing of async getters is not fully specified in the ES7 specification or EStree experimental documentation.
For example:

	var x = {
		// An async functional method. Invoke with 'await x.a()'
		async a() {
			return "A";
		},
		// A sync getter. Invoke with 'x.b'
		get b() {
			return "b" ;
		},
		// An async getter - NB: This does NOT parse as async, and will not work as expected.
		async get c() {
			return "c" ;
		}
	};

If you really want an async getter, the workaround is to set it via Object.defineProperty:

	Object.defineProperty(x,"c",{
		get:async function() { return "c" ; },
		enumerable:true
	}) ;
	
Diffrences from the ES7 specification
-------------------------------------
* Generators and Promises are optional. Nodent works simply by transforming your original source

* As of the current version, `finally { }` blocks are NOT transformed by Nodent

* As of the current version, `for (...in...)` and `for (...of...)` loops are NOT transformed by Nodent

* The ES7 async-await spec states that you can only use await inside an async function. This generates a warning in nodent, but is permitted. The synchronous return value from the function is compilation mode dependent, but generally a Thenable protocol representing the first awaitable expression. 

* The statements `return async <expression>` and `throw async <expression>` are proposed extensions to the ES7 standard (see https://github.com/lukehoban/ecmascript-asyncawait/issues/38). The alternative to this syntax is to use a standard ES5 declaration returning a Promise.

* async functions that fall-through (i.e. never encounter a `return` or `throw` (async or otherwise) do not return. In the ES7 spec, these functions return `undefined` when `await`ed. This behaviour does not permit async functions to be terminated by callbacks. To remain compatible with the ES7 spec, make sure your async functions either return, throw an exception or delegate to a callback that contains a `return async` or `throw async`. 

* Object and class getters and setters cannot be declared 'async' and must be explicitly defined.

API
===
Create an instance of a nodent compiler:

	var nodent = require('nodent')(options);
	
Options:

|Member| Type |  |
|-------|-----|------------------------|
|dontMapStackTraces|boolean|default: false
|augmentObject|boolean|Adds asyncify(PromiseProvider) and isThenable() to Object.prototype, making expressions such as `var client = new DB().asyncify(Promise)` and `if (abc.isThenable()) await abc()` less verbose
|extension|string|extension for files to be compiled (default: '.njs'). Note that this is unused if the file has a `use nodent-` directive.
|log (msg)|function|Called when nodent has a warning of similar to show. By default they are passed to console.warn(). Set this member to, for example, suppress logging

Return: a 'nodent' compiler object with the following properties:

|Member| Type |  |
|-------|-----|------------------------|
|version|string|The currently installed version|
|asyncify (PromiseProvider)|function|Return a function to convert an object with callback members to one with Thenable members. `asyncify` is also a meta-property (see below)
|Thenable (function)|function|Implements a minimal `.then()` member to interface with Promises. `Thenable` is also a meta-property (see below)
|require (moduleName,options)|object|Import an async helper module|
|generateRequestHandler (path, matchRegex, options)|function|Create a function use with Express or Connect that compiles files for a browser on demand - like a magic version of the 'static' middleware
|isThenable (object)|boolean|Return boolean if the supplied argument is Thenable (i.e. has an executable `then` member). All Promises and nodent.Thenable return true
|$asyncbind|function|Required runtime in ES7/Promises mode
|$asyncspawn|function|Required runtime in generator mode

Note the nodent object has other members used for implementation - these are subject to change and are not part of the API.

Meta-API
--------
You can over-ride certain defaults and access values that are global to the process (as opposed to module by module) by instantiating nodent _without_ an argument:

	var nodent = require('nodent') ;

The available meta-properties are:

| Member| Type |  |
|-------|-----|------------------------|
|Thenable|function|Default thenable protocol implementation|
|asyncify|object|Method to transform methods from callbacks to async functions by wrapping in Thenables|
|setDefaultCompileOptions (options)|function|Set the defaults for the compiler. This should be called before the first compiler is created.|

	// Turn off sourcemap generation:
	nodent.setDefaultCompileOptions({sourcemap:false}) 
	
	// Access values that are global to all nodent compiler instances
	var Promise = global.Promise || nodent.Thenable ;	// Set a Promise provider for this module
	nodent.asyncify
	
You still need to (at least once) create the compiler:

	var compiler = nodent(options) ;

The return ('compiler') has the additional, instance specific properties specified in the API above.

Built-in conversions & helpers
==============================

Nodentify has a (small but possibly growing) set of covers for common Node modules. You specify these through the `require` function:

	var nodent = require('nodent')() ;
	var nhttp = nodent.require('http') ; 

Some covers can accept a configuation object, in this case specify the options in the second parameter:

	var http = nodent.require('http',{autoProtocol:true}) ;

NB: As of v1.2.x, the previous nodent option `{use:["name"]}` option is deprecated (although still implemented), as it was dependent on module loading order in the case where you require a module that itself requires nodent with different options. To access a cover or helper, use the `nodent.require("name")` function.

As of version v1.2.7, the nodent initialisation option `{augmentObject:true}` adds the following functions to Object.prototype. Although polluting a global prototype is considered by some poor design, it is useful in some cases. Specifically, being able to determine if an object is Thenable (i.e. has a member called `then` which is a function), or `asyncify`ing  an arbitary object so it can be awaited on very handy. For example:

/* Create a redis client from a library that can be used with await */
var redis = require('redis').asyncify() ;

"http" and "https"
------------------
The nodent version of http.get returns a Thenable:

	nhttp.get(options).then(function(response){},function(error){}) ;

Hopefully you'll recognise this and be able to see you can now invoke it like:

	response = await nhttp.get(options) ;

To make life even easier, the response is covered too, just before the first callback is invoked with an addition async function called "wait", that waits for a named event. The whole setup is therefore:

	var nodent = require('nodent')() ; // You have to do this somewhere to enable nodent
		...
	var http = nodent.require('http') ;

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
The nodent cover "map" works like an aynchronous, parallel object/array mapper, similar to Array.prototype.map() or Promsie.all(). The map function takes three parameters: 

* the entity to iterate over, 
* optionally an object in which to place the results (they are returned from the async map in any case),
* the async function to call on each iteration. 

The function completes when all the aync-iteration function calls have completed (via a return or exception). The order of execution of each async function is not guarenteed. When complete, the async-return is a complementary object or array containing the mapped values as returned asynchronously. If present, the return values are placed into the optional second parameter. If omitted, a new object or array is created to hold the results. The initial argument (the entity to iterate over) can be either:

* An Object - each field is passed to the async-iterator function
* An Array - each element is passed to the async-iterator function
* A single Number - the async function is invoked with the integer values 0 to Number-1
* An array or Object of async functions - each function in the array is invoked asynchronously. In this case the third parameter must be omitted.

Example: mapping an object

	// Use nodent.map
	var map = nodent.require('map') ;

	// Asynchronously map every key in "myObject" by adding 1 to the value of the key
	mapped = await map(myObject,async function(key){
		// This can be async without issues
		return myObject[key]+1 ;	
	}) ;
	// All done - mapped contains the new object with all the elements "incremeneted"


Example: map an array of URLs to their content

	// Use nodent.map & http
	var map = nodent.require('map') ;
	var http = nodent.require('http') ;

	mapped = await map(['www.google.com','www.bbc.co.uk'],async function(value,index){
		// Get the URL body asynchronously.
		return await http.getBody("http://"+value) ;
	}) ;
	// All done - mapped is the new array containing the bodies

Example: iterate through a set of integer values and do something asynchronous with each one.

	// Use nodent.map & http
	var map = nodent.require('map') ;
	var http = nodent.require('http') ;

	mapped = await map(3,async function(i){
		// Get the URL body asynchronously.
		return await nodent.http.getBody("http://example.com/cgi?test="+i) ;
	}) ;
	// All done - mapped is the new array containing the bodies

Example: execute arbitrary async functions in parallel and return when they are all complete

	// Use nodent.map
	var map = nodent.require('map') ;

	mapped = await map([asyncFn("abc"),asyncFn2("def")]) ;
	
	/* All done - mapped is an new array containing the async-returns */

Example: execute arbitrary labelled async functions in parallel and return when they are all complete

	// Use nodent.map
	var map = nodent.require('map') ;

	mapped = await map({for:asyncFn("abc"),bar:asyncFn2("def")}) ;
	console.log(mapped.foo, mapped.bar) ;

	/* All done - mapped is an new object containing the async-returns in each named member */

In the latter two cases, where there is only an single parameter, the async return value from `map` is a corresponding array or object to the parameter where each member has been resolved if Thenable (a Promise or async function value), or passed through unchanged if not Thenable.

The order of execution is not guaranteed (as with all calls to map), but the completion routine will only be called when all async functions have finished either via a return or exception.  the first function (at index [0]) and the async-return of the second funcrion (at index [1]). There is no programmatic limit to the number of async functions that can be passed in the array. Note that the functions have no useful parameters (use a closure or wrap the function if necessary). The order of execution is not guaranteed (as with all calls to map), but the completion routine will only be called when all async functions have finished either via a return or exception.

### Exceptions in mapped functions
By default, in the event of an error or exception in the async-mapping function, the error value is substitued in the mapped object or array. This works well since all the exceptions will be instances of the JavaScript Error() type, and so they can be easily tested for in the mapped object after completion. 

The map() function only errors if an async function illegally returns more than once (including multiple errors or both an error and normal response).

Alternatively, if instantiated with the option `throwOnError`, if any of the async invocations throw an exception, `map()` will throw an Error() when all the functions have completed, with a member called `results` containing the other results. To use this option:

	var map = nodent.require('map',{throwOnError:true}) ;

Instances of 'map' are independent of each other - you can require() both the throwing and non-throwing version in different modules, or the same module as different variables.

nodent.asyncify
---------------
This helper function wraps "normal" Node asynchronous functions (i.e. those whose final paramter is of the form `function(err,data)`) to make them usuable with `await`. For example, to asyncify the standard Node module 'fs':

	// Require 'fs'
	var fs = require('fs') ;
	// Get a reference to nodent.asyncify
	var asyncify = require('nodent').asyncify ;
	// Asyncify 'fs'
	var afs = asyncify(nodent.Thenable)(fs) ;
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

27-Sep-15: Fix case where `if (x) return await y ;` incorrectly evaluated the `await` before the test.

23-Sep-15: Initial release of Nodent v2.x.x., which has moved from UglifyJS to the acorn parser and the ESTree AST representation, mainly for performance and to support ES6 targets such as Node v4.x.x

Upgrading
---------
Nodent v2 is a major update. There may be some breaking changes. Significant changes are:

* Moved from Uglify2 to Acorn for input parsing, and re-written much of tree manipulation
* Supports ES6 input syntax, so suitable for adding async & await to ES6 code in Node v4.x.x
* Additional tests for interoperability between es7, Promises and Generator mode
* Cleaner options for code generation and configuration.
* The old (<v1.0.38) ES5 assignment operator "<<=" and "async-function" syntax is no longer supported.
* The compiler always uses the Thenable protocol, even in -es7 mode, to ensure interoperability
* Additional ES5/6 constructs are available such as object/class method definitions can be marked `async` (see gotacha about `async get fn()`)
* ES6 constructs like arrow functions (and async arrows) and `super` are supported
* `arguments` is correctly mapped into async function bodies and no longer refer to the $return and $error parameters 
* Generator mode falls back to Promises mode to implement the non-ES7 standard extensions `return async expression`, `throw async expression` and `await` outside of an `async` function.
