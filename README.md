NoDent
======

NoDent is a small module for Nodejs that extends standard Javascript semantics to make writing, reading and understanding
asynchronous and callback methods more implicit and embedded in the language.

It works by optionally transforming JavaScript when it is loaded into Node. The excellent parser and code generator are 
courtesy of Uglify2 http://lisperator.net/uglifyjs/

Basic Use and Syntax
====================
Declare an asynchronous function (one that returns "later").

	async-function tellYouLater(sayWhat) {
		// Do something asynchronous and terminal, such as DB access, web access, etc.
		return result ;
	}

Call an async function:
	
	result <<= tellYouLater("Hi there") ;
	
That's the basics.  

How (and why) it works
======================
NoDent carries out two transformations on your JavaScript source as it is loaded into Node:
one to declare functions and one to call them (called an "Async Assignment" here). In each
case, normal, JavaScript functions are what are loaded into Node and executed. Node itself 
is not modified in anyway.

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
kind of assignment (because it is).
 
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
 
