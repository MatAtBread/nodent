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
27May14: Show both mapped and unmapped files & positions in stack traces. Can be suppressed with option {dontMapStackTraces:true}

22May14: Added a real world example. See Before and After below

22May14: Update async.map() to accepts an arbitrary set of async-functions as an object or array but WITHOUT a callback. The map will execute every function in the array/object before asynchronously returning a mapped object or array.

09Apr14: Update async.map() to accept a Number as the first argument. The async-callback is then called with integers from 0 to arg-1 rather than object keys or array elements.

26Mar14: Catch parsing errors in generateRequestHandler() and return them as HTTP errors

24Mar14: Add support for gzip,deflate in http.getBody

18Mar14: Add nodent.generateRequestHandler(path,regex,options). This returns a node request handler that is connect/express compatible that automatically parses a file-based nodent-syntax file into a standard, JS file suitable for use in a browser, complete with a source-map for easy debugging.

12Mar14: Add prototype to allow error handlers to be chained. See "Chaining errors" below.

10Feb14: Add convenience method body <<= http[s].getBody(url) - open, read and return a UTF-8 encoded response as a fully buffered string.

02Feb14: Make compile() log friendly error messages and throw an object of type Error if there is a problem parsing

31Jan14: Enforce wrapping of $error() values in a native JS "Error" if they are not already done so. To return "non-error" values, use "return", not "throw"

30Jan14: Add nodent.compile() to provide a one-step cross compilation. Expose optional "sourceMapping" parameter to allow for a server-side installation to cross-compile client-side JS on the fly

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

(NB: There are other mappings too, like checking for nested functions and try catch blocks, but the essence is demontsrated in the example above).

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

Chaining Errors
===============
Exceptions and other errors are caught and passed to the "hidden" callbacl function "$error". The automatic chaining of this
through an async-call path is really useful and one of the reasons Nodent has such a compact syntax. However, sometimes you 
need to intercept an error and handle it differently rather than just return it to the call chain.

Since "$error" is just a simple paraameter to async calls, this is pretty easy, but requires the creation of a variable
scope block (e.g. a function) which makes it look messy and verbose. To avoid this a hidden Function prototype chain$error()
exists to make it quick and easy. 

To handle an exception in the async call-chain, simply redefine $error before invoking the async-function, for example:

	async-function createDBrecord() {
		$error = $error.chain$error(function(ex,chained){
			if (Error.causedBy(ex,"ConstraintViolation")) {
				return $return("Thanks. Already exists.") ;
			} else {
				chained(ex) ;
			}
		}) ;

		data <<= sql("...") ;
		if (data) {
			return data ;
		} else {
			return null ;
		}
	}

In this example, before calling the database function, we redfine $error to intercept any exceptions and modify 
behaviour - in this case either calling $return (via the closure) or calling the original error handler (passed as
the final parameter to the overidden $error handler).

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
A nodent cover "async" provides a place to collect useful asynchronous functions with Nodent signatures. Initially, the only supported function is map(), which works like an aynchronous, parallel object/array mapper, similar to Array.map(). The map function takes three parameters: the entity to iterate over, optionally an object in which to place the results, and the async-function to call on each iteration. The function completes when all the aync-iteration function calls have completed (via a return or exception). The order of execution of each async-function is not guarenteed. When complete, the async-return is a complementary object or array containing the mapped values as return asynchronously. If present, the return values are placed into the optional second parameter. If omitted, a new object or array is created to hold the results. The initial argument (the entity to iterate over) can be either:
* An Object - each field is passed to the async-iterator function
* An array of Objects, Strings or Numbers - each element is passed to the async-iterator function
* A single Number - the async-function is invoked with the integer values 0 to Number-1
* An array or Object of async-functions - each function in the array is invoked asynchronously. In this case the third parameter must be omitted.

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
		body <<= nodent.http.getBody("http://"+value) ;
		return body ;
	}) ;
	// All done - mapped is the new array containing the bodies

Example: iterate through a set of integer values and do something asynchronous with each one.

	// Use nodent.async & http
	var nodent = require('nodent')({use:['http','async']}) ;
	
	mapped <<= nodent.async.map(3,async-function(i){
		// Get the URL body asynchronously.
		body <<= nodent.http.getBody("http://example.com/cgi?test="+i) ;
		return body ;
	}) ;
	// All done - mapped is the new array containing the bodies

Example: execute arbitrary async functions in parallel and return when they are all complete

	// Use nodent.async
	var nodent = require('nodent')({use:['async']}) ;
	
	mapped <<= nodent.async.map([asyncFn("abc"),asyncFn2("def")]) ;

	/* All done - mapped is an new array containing the async-return of the first function (at index [0]) and the async-return of the second funcrion (at index [1]). There is no programmatic limit to the number of async functions that can be passed in the array. Note that the functions have no useful parameters (use a closure or wrap the function if necessary). The order of execution is not guaranteed (as with all calls to async.map), but the completion routine will only be called when all async-functions have finished either via a return or exception. */

In the event of an error or exception in the async-mapping function, the error value is substitued in the mapped object or array. This works well since all the exceptions will be instances of the JavaScript Error() type, as they can be easily tested for in the mapped object after completion. The async.map() function only errors if an async-function illegal returns more than once (including multiple errors or both an error and normal response).

Function arguments
------------------
Because the assignment operator maps to the sequence with an embedded function call, it can be used to invoke functions that
accept function arguments with no mapping layer. A good example is "process.nextTick()". It exepcts a single function argument which is called by the Node event loop next time around. Using NoDent, you can invoke this functionality very easily:

	doItNow() ;
	undefined <<= process.nextTick ;
	doItABitLater();
	undefined <<= process.nextTick ;
	doItLaterStill() ;

Before and After
================

Here's an example from a real-world application. We find the NoDent-style code much easier to write, maintain, train new people on and debug than the JS callback-style code, mainly becuase of the large amount of anonymous function "glue" and the like which kind of hides the logic away. Anyway, take your choice. You can, of course, see your own code before and after  mapping, live, in node-inspector if you enable source-mapping.

Original code, as supplied to Node:

	clientApi.shareProduct = async-function(type,prod,message,img,networks){
		// Create a link that when clicked on can resolve into 
		// a (current-user, product) tuple, and which can generate
		// an affiliation link that itself identified the clicker
		// as well as the clickee tuple.

		messasge = message.trim() ;
		offer <<= createOffer(this.request.session.nid,type,prod,message,img,networks) ;
	
		sysEvent && sysEvent.emit('offer') ;
		if (!offer || !offer.p.resolved) 
			throw new Error("Product not fully resolved") ;

		// Now post this offer on FB and/or twitter
		var user = offer.u ;

		done <<= async.map(offer.offer.networks,async-function(net){
			posting <<= Networks.get(net).postStatus({
				id:user[net+"-id"],
				token:user[net+"-token"], 
				secret:user[net+"-secret"],
				user:user
			},message,offer.offer,false) ;
			return posting ;
		}) ;				

		updated <<= offer.offer.update({status:done}) ;
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
        	        return async.map(offer.offer.networks, function(net) {
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


