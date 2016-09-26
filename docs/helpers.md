Built-in conversions and helpers
==============================

Nodentify has a (small but possibly growing) set of covers for common Node modules. You specify these through the `require` function:

	var nodent = require('nodent')() ;
	var nhttp = nodent.require('http') ;

Some covers can accept a configuation object, in this case specify the options in the second parameter:

	var http = nodent.require('http',{autoProtocol:true}) ;

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

	// Make a request. Nodent creates the callbacks, etc. for you
	// and so you can read the line as "wait for the response to be generated"
	var response = await http.get("http://npmjs.org/~matatbread") ;

	var body = "" ;
	response.on('data',function(chunk){ body += chunk ;} ;

	// Wait for the "end" event
	await response.wait('end') ;

	// The response is complete, print it out
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

	// All done - mapped is an new array containing the async-returns

Example: execute arbitrary labelled async functions in parallel and return when they are all complete

	// Use nodent.map
	var map = nodent.require('map') ;

	mapped = await map({for:asyncFn("abc"),bar:asyncFn2("def")}) ;
	console.log(mapped.foo, mapped.bar) ;

	// All done - mapped is an new object containing the async-returns in each named member

In the latter two cases, where there is only an single parameter, the async return value from `map` is a corresponding array or object to the parameter where each member has been resolved if Thenable (a Promise or async function value), or passed through unchanged if not Thenable.

The order of execution is not guaranteed (as with all calls to map), but the completion routine will only be called when all async functions have finished either via a return or exception.  the first function (at index [0]) and the async-return of the second funcrion (at index [1]). There is no programmatic limit to the number of async functions that can be passed in the array. Note that the functions have no useful parameters (use a closure or wrap the function if necessary). The order of execution is not guaranteed (as with all calls to map), but the completion routine will only be called when all async functions have finished either via a return or exception.

### Exceptions in mapped functions
By default, in the event of an error or exception in the async-mapping function, the error value is substitued in the mapped object or array. This works well since all the exceptions will be instances of the JavaScript Error() type, and so they can be easily tested for in the mapped object after completion.

The map() function only errors if an async function illegally returns more than once (including multiple errors or both an error and normal response).

Alternatively, if instantiated with the option `throwOnError`, if any of the async invocations throw an exception, `map()` will throw an Error() when all the functions have completed, with a member called `results` containing the other results. To use this option:

	var map = nodent.require('map',{throwOnError:true}) ;

Instances of 'map' are independent of each other - you can require() both the throwing and non-throwing version in different modules, or the same module as different variables.

"asyncfunction"
---------------

The `AsyncFunction` type is returned by requiring 'asyncfunction'. This creates a class that can compile async functions on the fly (like `new Function()`).

To access the type:

	var AsyncFunction = nodent.require('asyncfunction',opts) ;

...where the `opts` parameter is optional, but if supplied contains the compiler flags as specified in [Advanced Configuration](../README.md#advanced-configuration). By default AsyncFunction uses Promises if they are defined globally, and ES7 mode otherwise.

Once defined, you can create async functions on the fly just like normal functions:

    // Create a new async function
    var add = new AsyncFunction("i","j","return i+j") ;

    console.log(add instanceof Function)		// true: An AsyncFunction is also a function
    console.log(add instanceof AsyncFunction)	// true
    console.log(add.toString())					// The original source "return i+j"
    console.log(add.toES5String())				// The compiled source
    console.log(await add(10,11))				// 21

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

If you specifiy the environment option `augmentObject` as in `require('nodent')({augmentObject:true})` you can directly asyncify an API, for example:

	// Create a redis client from a library that can be used with await
	var redis = require('redis').asyncify() ;

