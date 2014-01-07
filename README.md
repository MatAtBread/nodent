NoDent
======

NoDent is a small module for Nodejs that extends standard Javascript semantics to make writing, reading and understanding asynchronous and callback methods more implicit and embedded in the language.

It works by (optionally) transforming JavaScript when it is loaded into Node. The excellent parser and code generator are courtesy of Uglify2 http://lisperator.net/uglifyjs/

Basic Use and Syntax
====================
Declare an asynchronous function (one that returns "later").

	async-function tellYouLater(sayWhat) {
		// Do something asynchronous and terminal, such as DB access, web access, etc.
		return result ;
	}

Call an async function:
	
	result <<= tellYouLater("Hi there") ;
	
To use NoDent, you need to:

	require('nodent')() ;
	
This must take place early in your app, and need only happen once per app - there is no need to require('nodent') in more 
than one file, once it is loaded it will process any files ending in ".njs" or containing the 'use nodent'; at the top
of a .js file. 

That's the basics.

Changelog
=========
04Jan14: Addition of "async" cover providing async object/array mapping facilities.

29Nov13: Handle the case where we want to chain async-functions. See "Return Mapping" below.

27Nov13: Change from delegation to prototype inheritance to expose un-nodented http/http functions. Add warning about duplicate augmentation of EventEmitter.wait()

25Nov13: Added support for Source Maps to allow for NoDentJS debugging. At present, it seems impossible to enable it for both Node and Web use (although for web use, it would be much more efficient to pre-compile the files) so it it named for Node. In the node-inspector debug session, each processed file will appear twice: under it's usual name as NoDent source, and also under "xxx.js.nodent" which is the compiled output. Take care stepping as the node-inspector "step over" does not skip to the next line in the file, but the next executable statement, which is not the same thing in a nodent source file.

21Nov13: NoDent is currently actively developing and in use in a commercial project. The API & Syntax are stable, but not entirely frozen. If you wish to build it is recommended you build against a specific major.minor version.


How (and why) it works
======================
NoDent carries out two transformations on your JavaScript source as it is loaded into Node:
one to declare functions and one to call them (called an "Async Assignment" here). In each
case, normal, JavaScript functions are what are loaded into Node and executed. Node itself 
is not modified in anyway.

NoDent is a not a "framework" - there is no runtime JavaScript to include in your project and it does not execute other than at load time to transform your NoDented files into standard JavaScript.

Declaring Async Functions
=========================

The async function definition:

		async-function myFunc(args) { 
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

(NB: There are other mappings too, like checking for nested functions and try catch blocks, but the essence is demontsrated in the exmaple above).

Remember, we're simply transforming a syntactic short-cut into a "normal" JS function. Don't be confused by the
$return and $error identifiers (which are all configuarble in any case), they're just normal JS identifiers (in fact,
they're functions).

NoDent uses the "funcback" pattern, where a function returns a function that expects two callback arguments, 
one to handle the result, and another to handle exceptions (bear with me - it sounds worse than it is). This pattern
is great because async calls can be easily chained with one another, in particular the "onError" callback can often 
just be passed straight through to each function in turn as the error callback. 

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
functions returning functions. AJS introduces two syntactic constructs to make this pattern readable and
"natural" for all those procedural, synchronous guys out there.

To declare an asynchronous function, put "async-" in front of the definition. Note "async" is like a modifier,
there's no variable or function called "async", the syntax transformer just checks for that lexical token. This
is how it looks:

	async-function myFunc(args) {
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
 
There's no useful "return" as such (although it is reasonable and easy to implement async
cancellation by returning an object that can be invoked to cancel the async operation). The 
result of executing "doSomething" is passed back into "success" in the example above, unless
an exception is thrown, in which case it ends up in the "except" parameter. Note that
although this is designed for asynchronous callbacks, transforming the source doesn't ensure
that. The above example looks pretty synchronous to me, and a few lines like those above
would get pretty messy pretty quickly.

Return Mapping
==============
The process which transforms "return 123" into "return $return(123)" is called Return Mapping. It
also maps the other kind of returns (exceptions) and handles nested returns. However, there is an
common optimisation in synchronous code where one routine returns the return of another, such as:

	return s_other(123) ;	// Synchronous

In Nodent, you have to do this by typing:

	result <<= a_other(123) ;	// Asynchronous
	return result ;

The intermediate variable "result" is pretty harmless, bu the creation of the hidden callback is a small
overhead that can be avoided by simple passing throw all the async values:

	return a_other(123,$return,$error) ; 	// Callbacks passed as normal JS call to async-call

The problem here is it will be wrapped in another call to $return, result in the callback being
called twice, which is usually a very bad idea. To make this optimisation possible, returning a
"void" is NOT wrapped so the statement below does what we want:

	return void (a_other(123,$return,$error)) ; 	// Callbacks passed as normal JS call, don't mess with the return

Async assignment
================

The other transformation is a shorter call sequence. It's meant to look like a special
kind of assignment (because it is). It is ithis transformation that stops all the crazy 
indenting that async callbacks generate.
 
 	result <<= myFunc(args) ;
 	moreStuff(result) ;
 
This is transformed into the code:
 	
 	return myFunc(args)(function(result) {
 		moreStuff(result) ;
 	},$error) ;
 
Yes, it hides a return statement in your code. If you step line by line, you WON'T hit "moreStuff"
immediately after executing "<<=", it will be called later, when myFunc invokes your "success" handler.
 
Note that you don't need to declare the left hand side of "<<=" (i.e. "result" in the example). It's
actually created as a "parameter" to the rest of the code in the block.
 
Why "<<="? Not modifying JS syntax means existing editors and checkers shouldn't complain.
Introducing new operators would mean updating the parser and might clash with future JS changes. But won't 
it break existing JS code? Only code that is already potentially broken - the right hand side of - and <<= 
are defined by JS not to be function definitions. If you have functions to the right of - and <<=
your code is already broken (NB: there are some caveats here in that static syntax transformation
can't tell whats on the right isn't really a number, but we check it looks like a call rather than
a variable. In this way you can "repair" any broken code). In any case, the file extension for AJS 
is ".njs", so your shouldn't be running any existing .js files through it in any case. Finally, judicious
use of parenthesis will allow uou to restore the original functionality.

Built-in conversions
====================

Nodentify has a (small but possibly growing) set of covers for common Node modules. You specify these through the parameter when requiring nodent:

	require('nodent')({use:['http']}) ;

Nodent will require and instantiate the http library for you and attach it to the return, so you can say:

	var http = require('nodent')({use:['http']}).http ;

http(s)
-------
The nodent version of http.get has JS "funcback" the signature:

	nodent.http.get(options)(function(response){},function(error){}) ;

Hopefully you'll recognise this and be able to see you can now invoke it like:

	response <<= nodent.http.get(options) ;

To make life even easier, the response is covered too, just before the first callback is invoked with an addition "funcback" called "wait", that waits for a named event. The whole setup is therefore:

	var http = require('nodent')({use:['http']}).http ;

	/* Make a request. Nodent creates the callbacks, etc. for you
	and so you can read the line as "wait for the response to be generated" */	
	response <<= http.get("http://npmjs.org/~matatbread") ;

	var body = "" ;
	response.on('data',function(chunk){ body += chunk ;} ;

	/* Wait for the "end" event */
	undefined <<= response.wait('end') ;

	/* The response is complete, print it out */
	console.log('The response is:\n"+body) ;

http.request is similar, but not identical as you will need access to the request object to end it (amongst other things):

	req <<= http.request(options) ;
	req.end() ;	 // Do whatever you need to with the request
	// Wait for the "response" event
	response <<= req.wait('response') ;
	var body = "" ;
	response.on('data',function(chunk){ body += chunk ;} ;
	// Wait for the response to be completed
	undefined <<= response.wait('end') ;
	console.log('The response is:\n"+body) ;

"async"
-------
A nodent cover "async" provides a place to collect useful asynchronous functions with Nodent signatures. Initially, the only supported function is map(), which works like an aynchronous, parallel object/array mapper, similar to Array.map().

Example: mapping an object

	// Use nodent.async
	var async = require('nodent')({use:['async']}).async ;
	
	// Asynchronously map every key in "myObject" by adding 1 to the value of the key
	mapped <<= async.map(myObject,async-function(key){
		return myObject[element]+1 ;	// This can be async without issues
	}) ;
	// All done - mapped contains the new object with all the elements "incremeneted"


Example: map an array of URLs to their content

	// Use nodent.async & http
	var nodent = require('nodent')({use:['http','async']}) ;
	
	mapped <<= nodent.async.map(['www.google.com','www.bbc.co.uk'],async-function(value,index){
		// Get the URL body asynchronously.
		response <<= nodent.http.get("http://"+value) ;
		var body = "" ;
		response.on('data',function(chunk){ body += chunk ;} ;
		// Wait for the "end" event 
		undefined <<= response.wait('end') ;
		return body ;
	}) ;
	// All done - mapped is the new array containing the bobies

In the event of an error or exception in the async-mapping function, the error value is substitued in the mapped object or array. This works well if the return values is of a specific type, such as the JavaScript Error() type, as they can be easily tested for in the mapped object. the async.map() function only errors if an async-function illegal returns more than once (including multiple errors or both an error and normal response).


Function arguments
------------------
Because the assignment operator maps to the sequence with an embedded function call, it can be used to invoke functions that
accept function arguments with no mapping layer. A good example is "process.nextTick()". It exepcts a single function argument which is called by the Node event loop next time around. Using NoDent, you can invoke this functionality very easily:

	doItNow() ;
	undefined <<= process.nextTick ;
	doItABitLater();
	undefined <<= process.nextTick ;
	doItLaterStill() ;


