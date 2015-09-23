Nodent: How (and why) it works
==============================
NoDent carries out transformations on your JavaScript source as it is loaded into Node.
In each case, normal, JavaScript functions are what are loaded into Node and executed. Node itself
is not modified in anyway.

NoDent is a not a "framework" - there is no runtime JavaScript to include in your project and it does not execute other than at load time to transform your NoDented files into standard JavaScript.

The transformations are combinations of cutting block statements up and wrapping them in a synthetic functions so they can be invoked asynchronously, for example, the statement

	if (condition) {
		doSomething() ;
	} else {
		await doSomthingElse() ;
	}
	more ;

if (and only if) one of the code paths is asynchronous (i.e. contains an `await`) is transformed to:
	
	if (condition) {
	    doSomething();
	    return $post_if_condition$1.call(this);
	} else {
	    return doSomthingElse().then(function($await_doSomthingElse$2) {
	        return $post_if_condition$1.call(this);
	    }, $error);
	}
	
	function $post_if_condition$1() {
	    more;
	}
	return $post_if_condition$1.call(this);
[_TRY-IT_](http://nodent.mailed.me.uk/#%09if%20(condition)%20%7B%0A%09%09doSomething()%20%3B%0A%09%7D%20else%20%7B%0A%09%09await%20doSomthingElse()%20%3B%0A%09%7D%0A%09more%20%3B%0A)


Declaring Async Functions
=========================

The async function definition:

		async function myFunc(args) {
			body ;
			return expr ;
		}

is mapped to:

	function myFunc(args) {
	    return new Promise(function($return, $error) {
	        body;
	        return $return(expr);
	    });
	}
[_TRY-IT_](http://nodent.mailed.me.uk/#async%20function%20myFunc(args)%20%7B%0A%20%20body%20%3B%0A%20%20return%20expr%20%3B%0A%7D)

(NB: There are other mappings too, like checking for nested functions and try catch blocks, but the essence is demonstrated in the example above).

Remember, we're simply transforming a syntactic short-cut into a "normal" JS function. Don't be confused by the
$return and $error identifiers (which are configuarble in any case), they're just normal JS identifiers (in fact,
they're functions).

NoDent async functions return `Thenables`, where a function returns an object that has a `then()` member function that expects two callback arguments, one to handle the result, and another to handle exceptions (bear with me - it sounds worse than it is). This pattern is great because async calls can be easily chained with one another, in particular the "onError" callback can often just be passed straight through to each function in turn as the error callback.

`Thenables` are very similar in concept to Promises, but without the run-time API such as .then(), .reject(), etc.,
which makes it more efficient as there is no object required to represent the state or callbacks. (Note, they provide less functionality - in particular then can only have one 'listener' attached by `then()` and the listener must be attached before the function starts - there is no buffering as there is with Promises, and no chaining. Neither of these feature is used by Nodent.

`Thenable` patterned JS looks like the second function above, and is called like this:

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
	    return new Promise(function($return, $error) {
	        if (!args) {
	            return $error(new Error("Missing parameters"));
	        }
	        return $return(doSomething(args));
	    });
	}
[_TRY-IT_](http://nodent.mailed.me.uk/#%09async%20function%20myFunc(args)%20%7B%0A%09%20%09if%20(!args)%0A%09%20%09%09throw%20new%20Error(%22Missing%20parameters%22)%20%3B%0A%09%20%09return%20doSomething(args)%20%3B%0A%09%7D%0A)

This is just a normal JS function, that you can call like:

	myFunc(args).then(function(success){...}, function(except){...}) ;

There's no useful synchronous "return" as such (although it is reasonable and easy to implement async
cancellation by returning an object that can be invoked to cancel the async operation). The
result of executing "doSomething" is passed back into "success" in the example above, unless
an exception is thrown, in which case it ends up in the "except" parameter. Note that
although this is designed for asynchronous callbacks, transforming the source doesn't ensure
that. The above example looks pretty synchronous to me, and a few lines like those above
would get pretty messy pretty quickly.

Async invocation
================

The other principal transformation is a shorter call sequence, through the ES7 keyword `await`. In Nodent
it's implemented as a unary prefix operator (in the same kind of place you might find 'typeof' or
'delete'). It is this transformation that stops all the crazy indenting that async callbacks generate.

	var result = await myFunc(args) ;
	moreStuff(result) ;

This is transformed into the code:

	return myFunc(args).then(function($await_myFunc$1) {
	    var result = $await_myFunc$1;
	    moreStuff(result);
	}, $error);
[_TRY-IT_](http://nodent.mailed.me.uk/#%09var%20result%20%3D%20await%20myFunc(args)%20%3B%0A%09moreStuff(result)%20%3B)

Yes, it hides a return statement in your code. If you step line by line, you WON'T hit "moreStuff"
immediately after executing the line, it will be called later, when myFunc invokes your "success" handler.

Return Mapping
==============
The process which transforms "return 123" into "return $return(123)" is called Return Mapping. It
also maps the other kind of returns (exceptions) and handles nested returns. For async functions, the
plain return statement is mapped to the ES5 statement `return $return(...)`. 

Sometimes, for example if you want to return some mechanism for aborting an async function, you may wish to return a synchronous value as well. You can achieve this in a nodent async function by preceding synchronous return value with a `void` keyword. For example:

	async function getSlowRemote() {
		// Do the async return after 60 seconds
		var timer = setTimeout($return,1000) ;
		// Return a synchronous value too:
		return void function() {
			console.log("aborted") ;
			clearTimeout(timer) ;
		}
	}  

	// Invoke the async function using ES5 syntax, retainig the synchronous return value	
	var abort = getSlowRemote()(function(){
		console.log("done") ;
	}) ; 
	
	// Abort the slow operation - "done" is not logged
	abort() ;

Note that this behaviour (use of the "void" keyword to return a synchronous value) is NOT an ES7 standard, and may break some Promise implementations. 

Exceptions and $error
=====================
Nodent defines a default error handler (as global.$error) which throws an exception. This allows you to catch exceptions for async functions in the caller, just as you'd expect:

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
[_TRY-IT_](http://nodent.mailed.me.uk/#%09async%20function%20test(x)%20%7B%0A%09%09if%20(!x)%0A%09%09%09throw%20new%20Error(%22Missing%20parameter%22)%20%3B%0A%09%09return%20x%2B1%20%3B%0A%09%7D%20%3B%0A%0A%09async%20function%20testEx()%20%7B%0A%09%09try%20%7B%0A%09%09%09await%20test(1)%20%3B%20%2F%2F%20No%20problem%0A%09%09%09await%20test()%20%3B%09%2F%2F%20Oops!%20Missing%20parameter%0A%09%09%09return%20await%20test(2)%20%3B%0A%09%09%7D%20catch%20(ex)%20%7B%0A%09%09%09console.log(ex)%20%3B%09%2F%2F%20Print%20the%20exception%0A%09%09%09return%20-1%20%3B%09%09%09%2F%2F%20Swallow%20it%20and%20return%20-1%0A%09%09%7D%0A%09%7D%0A%0A%09console.log(await%20testEx())%20%3B%0A)

Chaining Errors
===============
Exceptions and other errors are caught and passed to the "hidden" callback function "$error" which rejects the Promise. The automatic chaining of this through an async-call path is really useful and one of the reasons Nodent has such a compact syntax. However, sometimes you need to intercept an error and handle it differently rather than just return it to the call chain, and ultimately throw an exception.

One common use case is invoking an async function with a specialised hander, for example to produce HTTP errors:

	// Call the async function test (above), but pass errors back via HTTP, not exceptions:
	// Instead of 'await test(...)
	test(x).then(function(result){
		response.statusCode = 200 ;
		response.end(JSON.stringify(result)) ;
	},function(error){
		response.statusCode = 500 ;
		response.end(JSON.stringify(error)) ;
	}) ;

If x==0, this will pass the exception back over HTTP, and if x!=0, it will pass the result back.

You can, or course, also handle this case with a `try...catch` block, but in the case above this is not itself 'an error', it's the way we choose to handle errors, and the use of `catch` hides the intention.

Gotchas
=======

Async programming with Nodent is much easier and simpler to debug than doing it by hand, or even using run-time constructs such as generators and promises, which have a complex implementation of the their own. However, a couple of common cases are important to avoid:

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
			return fileIyem[x] ;
		// Oops! If x==0, do something via a traditional Node callback
		fs.readFile("404.html",function(err,data){
				if (err) return $error(err) ;
				return $return(data) ;
		}) ;
		// NB: An implicit return here would cause $return() to be invoked twice
		// so exit without doing anything
	}
