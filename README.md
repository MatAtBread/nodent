[![NPM](https://nodei.co/npm/nodent.png?downloads=true&downloadRank=true)](https://nodei.co/npm/nodent/)

NoDent
======

NoDent is a small module for Nodejs that implements the JavaScript ES7 keywoards `async` and `await`. These make writing, reading and understanding asynchronous and callback methods more implicit and embedded in the language. It works by (optionally) transforming JavaScript when it is loaded into Node.

This README assumes you're using Nodent v2.x.x - see [Upgrading](#upgrading) if your upgrading from an earlier version.

Contents
--------
  * [Online demo](#online-demo)
  * [Basic Use and Syntax](#basic-use-and-syntax)
  * [Why Nodent?](#why-nodent)
  * [Installation](#installation)
  * [Command\-Line usage](#command-line-usage)
  * [Use within Node](#use-within-your-node-scripts)
    * [ES7 and Promises](#es7-and-promises)
  * [Use within a browser](#use-within-a-browser)
  * [async and await syntax](#async-and-await-syntax-and-usage)
  * [Gotchas and ES7 compatibility](#gotchas-and-es7-compatibility)
  * [Advanced Configuration](#advanced-configuration)
  * [API](#api)
  * [Built\-in conversions and helpers](#built-in-conversions-and-helpers)
  * [Testing](#testing)
  * [Changelog](#changelog)

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

You can't use the directive, or any other Nodent features in the file that initially `require("nodent")()`. If necessary, have a simple "loader.js" that requires Nodent and then requires your first Nodented file, or start your app with nodent from the command line:

	./nodent.js myapp.js

That's the basics.

Why Nodent?
===========

* _[Performance](#performance)_ - on current JS engines, Nodent is between 2x and 5x faster than other solutions in common cases, and up to 10x faster on mobile browsers.
* Simple, imperative code style. Avoids callback pyramids in while maintaining 100% compatibility with existing code.
* No dependency on ES6, "harmony"
* No run-time overhead for Promises, Generators or any other feature beyond ES5 - works on most mobile browsers & IE (although Nodent can use Promises and Generators if you want it to!)
* No execution framework needed as with traceur, babel or regenerator
* No 'node-gyp' or similar OS platform requirement for threads or fibers
* ES7 async and await on ES5 (most browsers and nodejs)
* Compatible with ES6 too - nodent passes ES6 constructs unchanged for use with other transpilers and Node > 4.x
* For more about ES7 async functions and await see:
  *  [http://wiki.ecmascript.org/doku.php?id=strawman:async_functions](http://wiki.ecmascript.org/doku.php?id=strawman:async_functions)
  *  [http://jakearchibald.com/2014/es7-async-functions/](http://jakearchibald.com/2014/es7-async-functions/)
  *  [https://github.com/lukehoban/ecmascript-asyncawait](https://github.com/lukehoban/ecmascript-asyncawait)

Installation
======================

	npm install --save nodent

Command-Line usage
==================
You can invoke and run a nodented JavaScript file from the command line (although for Node apps it's much easier using the [JS transpiler](#use-within-your-node-scripts)). To load, compile and run your JS file (containing `async` and `await`), use:

	./nodent.js myNodentedFile.js

You can also simply compile and display the output, without running it. This is useful if you want to pre-compile your scripts:

	./nodent.js --out myNodentedFile.js

If you are using nodent as part of a toolchain with another compiler, you can output the ES5 or ES6 AST is [ESTree](https://github.com/estree/estree) format:

	./nodent.js --ast myNodentedFile.js

...or read an AST from another tool

	./nodent.js --fromast --out estree.json // Read the JSON file as an ESTree AST, and output the nodented JS code

To generate a source-map in the output, use `--sourcemap`.

	./nodent.js --sourcemap --out myNodentedFile.js

The testing options `--parseast` and `--minast` output the source as parsed into the AST, before transformation and the minimal AST (without position information) respectively. The option `--pretty` outputs the source formatted by nodent before any syntax transformation. You can read the Javascript or JSON from stdin (i.e. piped) by omitting or replacing the filename with `-`.

The full list of options is:

|option|Description|
|-------------------|--------------------------------------|
| --fromast 		| Input is a JSON representation of an ESTree
| --parseast 		| Parse the input and output the ES7 specification ESTree as JSON
| --pretty 			| Parse the input and output the JS un-transformed
| --out 			| Parse the input and output the transformed ES5/6 JS
| --ast 			| Parse the input and output the transformed ES5/6 ESTree as JSON
| --minast 			| Same as --ast, but omit all the source-mapping and location information from the tree
| --exec 			| Execute the transformed code
| --sourcemap 		| Produce a source-map in the transformed code

Code generation options:

|option|Description|
|-------|----------|
| --use=_mode_ 		| Ignore any "use nodent" directive in the source file, and force compilation _mode_ to be `es7`,`promises`,`generators` or `default`
| --wrapAwait 		| Allow `await` with a non-Promise expression [more info...](#differences-from-the-es7-specification)
| --lazyThenables 	| Evaluate async bodies lazily in 'es7' mode. See the [Changelog](#changelog) for 2.4.0 for more information

Use within your Node scripts
============================
There is no need to use the command line at all if you want to do is use `async` and `await` in your own scripts then just  `require('nodent')()`. Files are transformed if they have a `use nodent...` directive at the top, or have the extension ".njs". Existing files ending in '.js' _without_ a `use nodent...` directive are untouched and are loaded and executed unchanged.

ES7 and Promises
----------------
Nodent can generate code that implements `async` and `await` using basic ES5 JavaScript, Promises (via a third party library or module, or an ES5+/6 platform) or Generators (ES6). Using the one of directives:

	'use nodent';
	'use nodent-promises';
	'use nodent-es7';
	'use nodent-generators';

The ES7 proposal for async and await specifies the syntactic elements `async` and `await` (i.e. where they can be placed), the execution semantics (how they affect flow of execution), but also the types involved. In particular, `async` functions are specified to return a Promise, and await should be followed by an expression that evaluates to a Promise. The proposal also contains an implementation based on generators.

### Which one should you use?
All the implementations work with each other - you can mix and match. If you're unsure as to which will suit your application best, or want to try them all out `'use nodent';` will use a 'default' configuration you can determine in your application's package.json. See [Advanced Configuration](#advanced-configuration) for details.

#### Shipping a self-contained app to a browser, Node <=0.10.x or other unknown environment
`use nodent-es7` - it's the most compatible as it doesn't require any platform support such as Promises or Generators, and works on a wide range of desktop and mobile browsers.

#### Shipping an app or module within Node, npm or [modern browsers supporting Promises](http://kangax.github.io/compat-table/es6/#test-Promise)
`use nodent-promises` provides the most compatibility between modules and apps. If your module or library targets Node earlier than v4.1.x, you should install a Promise library (e.g. rsvp, when, bluebird) or use `nodent.Thenable` or `nodent.EagerThenable()` to expose the Promise API.

#### Generators
`use nodent-generators` generates code which is reasonably easy to follow, but is best not used for anything beyond experimentation as it requires an advanced browser on the client-side, or Node v4.x.x. The performance and memory overhead of generators is poor - currently (Node v5.9.1) averaging 4 times slower compared to the es7 with 'lazyThenables'.

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
		es7:<boolean>,			// Compile in es7 mode (like 'use nodent-es7')
		promises:<boolean>,		// Compile in Promises mode (like 'use nodent-promises')
		generators:<boolean>,	// Compile in generator mode (like 'use nodent-generators')
		sourcemap:<boolean>,	// Create a sourcemap for the browser's debugger
		wrapAwait:<boolean>		// Allow 'await' on non-Promise expressions
		lazyThenables:<boolean>	// Evaluate async bodies lazily in 'es7' mode. See the Changelog for 2.4.0 for more information
	}
	setHeaders: function(response) {}	// Called prior to outputting compiled code to allow for headers (e.g. cache settings) to be sent

Note that parsing of script tags within HTML is relatively simple - the parsing is based on regex and is therefore easily confused by JS strings that contain the text 'script', or malformed/nested tags. Ensure you are parsing accurate HTML to avoid these errors. Scripts inline in HTML do not support source-mapping at present.

At runtime (i.e. in the browser), you'll need to provide some support routines:

* `Function.prototype.$asyncbind`
* `Function.prototype.$asyncspawn` if you're using generators
* `Object.$makeThenable` if you're using the `wrapAwait` option (see [await with a non-Promise](#differences-from-the-es7-specification)
*  `wndow.$error` if you use await outside of an async function, to catch unhandled errors, for example:

This are generated automatically in the transpiled files when you set the `runtime` option, and declared when Nodent is loaded (so they are already avaiable for use within Node).

	// Called when an async function throws an exception during
	// asynchronous operations and the calling synchronous function has returned.
	window.$error = function(exception) {
		/* Maybe log the error somewhere */
		throw ex ;
	};

Further information on using Nodent in the browser can be found at https://github.com/MatAtBread/nodent/issues/2.

Other options: Babel & Browserify
-------------
You can also invoke nodent from browserify as a [plugin](https://www.npmjs.com/package/browserify-nodent), or as an alternative, [faster implementation than](https://www.npmjs.com/package/fast-async) than Babel's [transform-async-to-generator](http://babeljs.io/docs/plugins/transform-async-to-generator/)

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

	/* An async function defined somewhere */
	async function readFile() { ... }

	/* Calling it using ES5 syntax in a non-nodented way */
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

Gotchas and ES7 compatibility
===========================

Async programming with Nodent (or ES7) is much easier and simpler to debug than doing it by hand, or even using run-time constructs such as Promises, which have a complex implementation of the their own when compiled to ES5. However, a couple of common cases are important to avoid.

Differences from the ES7 specification
--------------------------------------
* **case without break**

	As of the current version, `case` blocks without a `break;` that fall thorugh into the following `case` do not transform correctly if they contain an `await` expression. Re-work each `case` to have it's own execution block ending in `break`, `return` or `throw`. Nodent logs a warning when it detects this situation.

* **await outside async**

	The ES7 async-await spec states that you can only use await inside an async function. This generates a warning in nodent, but is permitted. The synchronous return value from the function is compilation mode dependent. In practice this means that the standard, synchronous function containing the `await` does not have a useful return value of it's own.

* **async return/throw**

	The statements `async return <expression>` and `async throw <expression>` are proposed extensions to the ES7 standard (see https://github.com/lukehoban/ecmascript-asyncawait/issues/38). The alternative to this syntax is to use a standard ES5 declaration returning a Promise. See [below](#exiting-async-functions-from-callbacks) for details.

* **AsyncFunction**

	The [`AsyncFunction`](#asyncfunction) type is _not_ defined by default, but is returned via the expression `require('nodent')(...).require('asyncfunction')`.

* **await non-Promise**

	Although not explicitly allowed in the specification, the template implementation allows an application to `await` on a non-Promise value (this occurs because the template implementation wraps every generated value in a Promise). So the statement:

		var x = await 100 ; // 100

	...is valid. Nodent, by default, does _not_ allow this behaviour (you'll get a run-time error about '100.then is not a function'. Generally, this is not a problem in that you obviously only want to wait on asynchronous things (and not numbers, strings or anything else). However, there is one unpleasant edge case, which is where an expression _might_ be a Promise (my advice is to never write code like this, and avoid code that does).

		var x = await maybeThisIsAPromise() ;

	In this case, the expression will need wrapping before it is awaited on by Nodent. You can emulate this behaviour by specifying the code-generation flag 'wrapAwait' in your package.json or after the nodent directive:

		'use nodent {"wrapAwait":true}';

	Wrapping every value in a Promise (or Thenable for -es7 mode) increases the time taken to invoke an async function by about 20%.

* **lazyThenables**

	Invoking an async function _without_ a preceding `await` (simply by calling it) executes the function body but you can't get the result. This is useful for initiating 'background' things, or running async functions for their side effects (Note: this behaviour only applied to ES7-mode from version 2.4.0). This is in compliance with the ES7 specification.  

	However, this has a significant performance overhead. For maximum performance, you can specify this code generation option in `use nodent-es7` mode, or use the `nodent.Thenable` in place of Promises in other modes. In this case, if you call the async function the body _is not actually executedy_ until resolved with an `await` (or a `.then()`). If you know your code always uses `await`, you can use this option to improve performance.

	In `use nodent-promises` mode, it is the implementation of the Promise that determines the execution semantics. The table below is a summary of modes and execution semantics. You can test the performance on your own hardware with the following command. Note the relative performance is a worst case, since the test does nothing other than make async calls in a loop.

		./nodent.js tests --generators tests/semantics/perf.js

| Mode | Flags / Implementation | Lazy / Eager | Possibly sync resolution | Performance (relative) |
|------|----------|----|--------------------------|------------------------|
| es7 | lazyThenable | Lazy | Yes | 1.0
| es7 | (none)| Eager | Yes | 2.3x slower
| promises | nodent.Thenable | Lazy | Yes | 1.0
| promises | nodent.EagerThenable() | Eager | No | 2.4x slower
| promises | node 5.9 native | Eager | No | 3.8x slower
| promises | bluebird 3.3.4 | Eager | No | 2.0x slower
| promises | rsvp 3.2.1 | Eager | No | 1.6x slower
| promises | when 3.7.7 | Eager | No | 1.6x slower
| generators | nodent.Thenable | Lazy | Yes | 6.5x slower
| generators | nodent.EagerThenable() | Eager | No | 9.0x slower
| generators | node 5.9 native | Eager | No | 12.0x slower
| generators | bluebird 3.3.4 | Eager | No | 8.5x slower
| generators | rsvp 3.2.1 | Eager | No | 7.8x slower
| generators | when 3.7.7 | Eager | No | 9.1x slower

All other JavaScript ES5/6/2015 constructs will be transformed as necessary to implement `async` and `await`.

Exiting async functions from callbacks
---------------------------------------

Specifically in Nodent (not specified by ES7), you can interface an ES7 async function with a old style callback-based function. For example, to create an async function that sleeps for a bit, you can use the standard setTimeout function, and in its callback use the form `async return <expression>` to not only return from the callback, but also the surrounding async function:

	async function sleep(t) {
	    setTimeout(function(){
	    	// NB: "async return" and "async throw" are NOT ES7 standard syntax
	    	async return undefined;
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
[_TRY-IT_](http://nodent.mailed.me.uk/#async%20function%20sleep%28t%29%20{%0A%20%20%20%20setTimeout%28function%28%29{%0A%20%20%20%20%20%20%20%20%2F%2F%20NB%3A%20%22return%20async%22%20and%20%22throw%20async%22%20are%20NOT%20ES7%20standard%20syntax%0A%20%20%20%20%20%20%20%20async%20return%20undefined%20%3B%0A%20%20%20%20}%2Ct%29%20%3B%0A})

Similarly, `async throw <expression>` causes the inner callback to make the container async function throw and exception. The `async return` and `async throw` statements are NOT ES7 standards (see [https://github.com/tc39/ecmascript-asyncawait/issues/38](https://github.com/tc39/ecmascript-asyncawait/issues/38)). If you want your code to remain compatible with standard ES7 implementations when the arrive, use the second form above, which is what nodent would generate and is therefore ES5/6/7 compatible.

Missing out await
-----------------
Forgetting to put `await` in front of an async call is easy, and usually not what you want - you'll get a Thenable (or Promise). This can be useful though, when you need a reference to an async function:

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

Advanced Configuration
======================
Nodent has two sets of configuration values:

* one controls the **runtime environment** - catching unhandled errors, handling warnings from Nodent and stack mapping, etc.
* the other controls **code generation** - whether to generate code that uses Promises or generators (or not), whether to await on non-Promise values, etc.

The first is defined _once_ per installation (Nodent contained as dependencies within dependencies have their own, per-installation, instances). You can 'redefine' the values, but the effect is to overwrite existing settings. These are specified as the first argument when you  `require('nodent')(options)`. Details of the options are [below](#api).

The second set is defined per-file for each file that Nodent loads and compiles.  The options are:

|Member| Type |  |
|-------|-----|------------------------|
|es7|boolean|set by the directive `use nodent-es7`
|promises|boolean|set by the directive `use nodent-promises`
|generators|boolean|set by the directive `use nodent-generators`
|wrapAwait|boolean|default: false [more info...](#differences-from-the-es7-specification)
|sourcemap|boolean|default:true - generate a source-map in the output JS
|parser|object|default:{sourceType:'script'} - passed to [Acorn](https://github.com/ternjs/acorn) to control the parser
|mapStartLine|int|default:0 - initial line number for the source-map
|generatedSymbolPrefix|string|used to disambiguate indentifiers created by the compiler

The members $return, $error, $arguments, $asyncspawn, $asyncbind, $makeThenable represent the symbols generated by the compiler. You could change them to avoid name clashes, but this is not recommended.

When determining what options to use when compiling an individual file, nodent follows the sequence:

* Use the set specified after the 'use nodent-' directive. For example 'use nodent-promises' uses a predefined set called 'promises'. Other predefined sets are 'es7' and 'generators'. If the `use nodent` doesn't have a name, the internal name "default" is used.
* Apply any modifications contained within the package.json two directories above where nodent is installed (typically the location of your application). The package.json can (optionally) contain a 'nodent' section to define your own sets of options. For example, to create a set to be used by files containing a `use nodent-myapp` directive:

		"nodent":{
			"directive":{
				"myapp":{
					"promises":true,
					"wrapAwait":true
				}
			}
		}

	You can also set options for the pre-defined sets here (default,es7,promises,generators).

* Finally, nodent applies any options specified _within_ the directive, but after the name. The options are strict JSON and cannot be an expression. This is useful for quickly testing options, but is probably a bad idea if applied to very many files. One exception is rare use of the `wrapAwait` options, which has a performance overhead and few genuine use-cases. For example, to create the same effect as the 'myapp' set above:

		'use nodent-promises {"wrapAwait":true}';

You can programmatically set these options _before_ creating the nodent compiler (but after requiring nodent) by using the setDefaultCompileOptions() and setCompileOptions() API calls.

Within a nodented file, the special symbol `__nodent` is expanded out to the current option set. It is not a variable and cannot be assigned to - it is an object literal. This has few useful use-cases, except for testing. An example is [here](https://github.com/MatAtBread/nodent/blob/master/tests/semantics/await.wrap.js)

API
===
Create an instance of a nodent compiler:

	var nodent = require('nodent')(options);

Options:

|Member| Type |  |
|-------|-----|------------------------|
|dontMapStackTraces|boolean|default: false
|asyncStackTrace|boolean|default: false - chain stack traces across `await` for easier debugging. Note this has a significant impact on memory requirements (and some performance penalty) at runtime, and should not be used in production environments.
|augmentObject|boolean|Adds asyncify(PromiseProvider) and isThenable() to Object.prototype, making expressions such as `var client = new DB().asyncify(Promise)` and `if (abc.isThenable()) await abc()` less verbose
|extension|string|extension for files to be compiled (default: '.njs'). Note that this is unused if the file has a `use nodent-` directive.
|log (msg)|function|Called when nodent has a warning of similar to show. By default they are passed to console.warn(). Set this member to, for example, suppress logging

Return: a 'nodent' compiler object with the following properties:

|Member| Type |  |
|-------|-----|------------------------|
|version|string|The currently installed version|
|asyncify (PromiseProvider)|function|Return a function to convert an object with callback members to one with Thenable members. `asyncify` is also a meta-property (see below)
|Thenable (function)|function|Implements a minimal `.then()` member to interface with Promises. `Thenable` is also a meta-property (see below)
|EagerThenable() (function)|function|Implements `.then()` with the same execution semantics as a Promise (eager evaluation and asynchronous resolution), but without chaining. `EagerThenable()` is also a meta-property (see below)
|require (moduleName,options)|object|Import an async helper module|
|generateRequestHandler (path, matchRegex, options)|function|Create a function use with Express or Connect that compiles files for a browser on demand - like a magic version of the 'static' middleware
|isThenable (object)|boolean|Return boolean if the supplied argument is Thenable (i.e. has an executable `then` member). All Promises, `nodent.EagerThenable()` and `nodent.Thenable` return true
|$asyncbind|function|Required runtime in ES7/Promises mode
|$asyncspawn|function|Required runtime in generator mode

Note the nodent object has other members used for implementation - these are subject to change and are not part of the API.

Meta-API
--------
You can over-ride certain defaults and access values that are global to the process (as opposed to module by module) by instantiating nodent _without_ an argument:

	var nodentMeta = require('nodent') ;

The available meta-properties are:

| Member| Type |  |
|-------|-----|------------------------|
|Thenable|function|Default thenable protocol implementation|
|EagerThenable|function|EagerThenable() protocol factory|
|asyncify|object|Method to transform methods from callbacks to async functions by wrapping in Thenables|
|setDefaultCompileOptions (compiler[,env])|function|Set the defaults for the compiler and environment. This should be called before the first compiler is created. The default environment options (`log augmentObject extension dontMapStackTraces asyncStackTrace`) will be used when the corresponding option is missing when the compiler is created. The compiler options (`sourcemap` and default symbol names) must be set before the first compiler is created. The other compilation options (`es7 promises generators`) are set by the corresponding directive|
|setCompileOptions (name,compiler)|function|Set the compilation options for a named [directive](#advanced-configuration) for the compiler. This should be called before the first compiler is created.

	// Turn off sourcemap generation:
	nodentMeta.setDefaultCompileOptions({sourcemap:false},{asyncStackTrace:true})

	// Access values that are global to all nodent compiler instances
	var Promise = global.Promise || nodentMeta.Thenable ;	// Set a Promise provider for this module
	nodentMeta.asyncify

You still need to (at least once) create the compiler:

	var nodent = nodentMeta(options) ;

The return ('compiler') has the additional, instance specific properties specified in the API above.

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

"asyncfunction"
---------------

The `AsyncFunction` type is returned by requiring 'asyncfunction'. This creates a class that can compile async functions on the fly (like `new Function()`).

To access the type:

	var AsyncFunction = nodent.require('asyncfunction',opts) ;

...where the `opts` parameter is optional, but if supplied contains the compiler flags as specified in [Advanced Configuration](#advanced-configuration). By default AsyncFunction uses Promises if they are defined globally, and ES7 mode otherwise.

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

	/* Create a redis client from a library that can be used with await */
	var redis = require('redis').asyncify() ;

Testing
=======

Nodent has a test suite (in ./tests) which is itself a node package. Since it requires a bunch of Promise implementations to test against, it is NOT installed when 'nodent' is installed. The Promise implementations are option - you can run the tests using the nodent es7, Thenable and native Promises (if available) without installing any other modules. If you want to run the tests:

	cd tests
	npm install
	cd ..
	./nodent.js tests

The tests themselves are normal (nodented) JavaScript files invoked with the parameters require,module and Promise. If you want to add a test, make sure it exports a single async function which the test runner can call. The async return value from this function should be `true` for success and `false` for failure.

If you wish to add a Promise implementation to test against, add it to the dependencies in tests/package.json and give it an entry in the tests/index.js test runner.

The test runner in tests/index.js accepts the following options:

	./nodent.js tests [OPTIONS] [test-files]

	--quiet      	Suppress any errors or warnings
	--quick      	Don't target a specific execute time, just run each test once
	--generators 	Performance test syntax transformations (the default) and generators as well
	--genonly	 	Only run the performance tests for generator mode
	--syntax	 	Check the parser/output code before running semantic tests
	--syntaxonly	Only run syntax tests
	--forceStrict	Run the tests with a 'use strict' inserted at the top of every test file

Note, the following options were removed in v2.5.0. Use the [command-line options](#command-line-usage) `--out` and `--use` instead.

	--output     	Show the generated ES5 code for Promises
	--es7        	Show the generated ES5 code for ES7 mode
	--save       	Save the output (must be used with --out or --es7)

Performance
-----------

Run the test script without the `--quick` option to see how nodent code performs in ES7 mode, Promises and generators on your platform. The specific 'perf' test just calls and awaits in a tight loop:

	./nodent.js tests --generators tests/semantics/perf.js

Additionally, a try the following links to test performance against Babel and Traceur.

[nodent](http://nodent.mailed.me.uk/#function%20pause%28%29%20{%0A%20%20%20%20return%20new%20Promise%28function%20%28%24return%2C%20%24error%29%20{%0A%20%20%20%20%20%20%20%20setTimeout%28function%20%28%29%20{%0A%20%20%20%20%20%20%20%20%20%20%20%20return%20%24return%280%29%3B%0A%20%20%20%20%20%20%20%20}%2C%200%29%3B%0A%20%20%20%20}%29%3B%0A}%0A%0Aasync%20function%20doNothing%28%29%20{%0A%20%20%20%20return%3B%0A}%0A%0Aasync%20function%20test%28%29%20{%0A%20%20%20%20var%20t%20%3D%20Date.now%28%29%3B%0A%20%20%20%20for%20%28var%20j%20%3D%200%3B%20j%20%3C%2050%3B%20j%2B%2B%29%20{%0A%20%20%20%20%20%20%20%20for%20%28var%20i%20%3D%200%3B%20i%20%3C%201000%3B%20i%2B%2B%29%20{%0A%20%20%20%20%20%20%20%20%20%20%20%20await%20doNothing%28%29%3B%0A%20%20%20%20%20%20%20%20}%0A%20%20%20%20%20%20%20%20await%20pause%28%29%3B%0A%20%20%20%20}%0A%20%20%20%20return%20Date.now%28%29%20-%20t%3B%0A}%0A%0Atest%28%29.then%28alert%29%3B%0A) 456ms ('Pure ES5' mode is even faster - 261ms), or 696ms using 'Promises/Generator' mode.

[babel](https://babeljs.io/repl/#?experimental=true&evaluate=true&loose=false&spec=false&code=function%20pause%28%29%20{%0A%20%20%20%20return%20new%20Promise%28function%20%28%24return%2C%20%24error%29%20{%0A%20%20%20%20%20%20%20%20setTimeout%28function%20%28%29%20{%0A%20%20%20%20%20%20%20%20%20%20%20%20return%20%24return%280%29%3B%0A%20%20%20%20%20%20%20%20}%2C%200%29%3B%0A%20%20%20%20}%29%3B%0A}%0A%0Aasync%20function%20doNothing%28%29%20{%0A%20%20%20%20return%3B%0A}%0A%0Aasync%20function%20test%28%29%20{%0A%20%20%20%20var%20t%20%3D%20Date.now%28%29%3B%0A%20%20%20%20for%20%28var%20j%20%3D%200%3B%20j%20%3C%2050%3B%20j%2B%2B%29%20{%0A%20%20%20%20%20%20%20%20for%20%28var%20i%20%3D%200%3B%20i%20%3C%201000%3B%20i%2B%2B%29%20{%0A%20%20%20%20%20%20%20%20%20%20%20%20await%20doNothing%28%29%3B%0A%20%20%20%20%20%20%20%20}%0A%20%20%20%20%20%20%20%20await%20pause%28%29%3B%0A%20%20%20%20}%0A%20%20%20%20return%20Date.now%28%29%20-%20t%3B%0A}%0A%0Atest%28%29.then%28alert%2Calert%29%3B%0A) 684ms - more than 1.5x slower

[traceur](https://google.github.io/traceur-compiler/demo/repl.html#%2F%2F%20Options%3A%20--annotations%20--array-comprehension%20--async-functions%20--async-generators%20--exponentiation%20--export-from-extended%20--for-on%20--generator-comprehension%20--member-variables%20--proper-tail-calls%20--require%20--symbols%20--types%20%0Afunction%20pause%28%29%20{%0A%20%20%20%20return%20new%20Promise%28function%20%28%24return%2C%20%24error%29%20{%0A%20%20%20%20%20%20%20%20setTimeout%28function%20%28%29%20{%0A%20%20%20%20%20%20%20%20%20%20%20%20return%20%24return%280%29%3B%0A%20%20%20%20%20%20%20%20}%2C%200%29%3B%0A%20%20%20%20}%29%3B%0A}%0A%0Aasync%20function%20doNothing%28%29%20{%0A%20%20%20%20return%3B%0A}%0A%0Aasync%20function%20test%28%29%20{%0A%20%20%20%20var%20t%20%3D%20Date.now%28%29%3B%0A%20%20%20%20for%20%28var%20j%20%3D%200%3B%20j%20%3C%2050%3B%20j%2B%2B%29%20{%0A%20%20%20%20%20%20%20%20for%20%28var%20i%20%3D%200%3B%20i%20%3C%201000%3B%20i%2B%2B%29%20{%0A%20%20%20%20%20%20%20%20%20%20%20%20await%20doNothing%28%29%3B%0A%20%20%20%20%20%20%20%20}%0A%20%20%20%20%20%20%20%20await%20pause%28%29%3B%0A%20%20%20%20}%0A%20%20%20%20return%20Date.now%28%29%20-%20t%3B%0A}%0A%0Atest%28%29.then%28alert%2Calert%29%3B%20%0A) 1175ms - more than 2.5x slower

The example timings are from Chrome v49 on Mac OSX. I get even wider results with Firefox, and dramatically wider results on mobiles (nodent ES7 mode is upto 10x faster than generators and transpilers).

The test is a simple set of nested loops calling async functions that don't do much. The purpose is to illustrate the overhead generated in the transpilation by each compiler. In reality, you'd be crazy to use async calls for everything, but very well advised to use them for I/O bound operations (network, disks, etc). In these cases, you can be reasonably certain that the overhead generated by the compilers would be small in comparison to the actual operation....but it's nice to know you're not wasting cycles, right? For those who want to know why, the real reason is the use of generators (the suggested implementation in the ES7 async/await specification), which are inefficient natively (about 50% slower than using 'nodent-promises'), and even worse when transcompiled into ES5.

Changelog
==========

08-Jun-16 v2.5.6

- Fix command-line option `--use=(mode)` with text input

06-Jun-16 v2.5.5

- Correct hoisting of destructing var declarations (implemented in nodejs >6.0.0)

18-May-16 v2.5.4

- Bump acorn-es7-plugin (parses comments between async and function correctly)
- Correct resolution of package.json for npm >v3.x to ensure modules using different nodent configurations read the 'nearest' one based on the location of the source, not the nodent installation directory

03-May-16 v2.5.2, v2.5.3

- Update to latest acorn (2.5.3)
- Update acorn-es7-plugin to correctly parse the statement `export async function name(){...}` as _async function name(){...}_ is a valid named declaration. (2.5.2)

21-Apr-16 v2.5.1

- Place runtimes ($asyncbind and $asyncspawn) in a separate file ('lib/runtime.js') so the dedicated Babler or other tool builder can extract them without having to include the entire compiler.

01-Apr-16 v2.5.0

- Implement `nodent.EagerThenable()` to provide Promise-like (but unchainable) execution semantics (eager evaluation, asynchronous resolution)
- Implement new test harness to collate performance by mode and Promise implementation
- Allow optional passing of a Promise type to the covers http, https, map, events and movre Thenable to it's own fix to ease integration with Browserify or Webpack (specifically, these covers can be required directly as there is no hard dependancy on the 'nodent' parameter, and so no need to require the entire library into thebrowser). The default behaviour is now to use the global.Promise if present, or nodent.Thenable if not.
- Update README

01-Mar-16 v2.4.1

- Significant improvement in compilation speed by re-factoring output.js (thanks to [@davidbonnet](https://github.com/davidbonnet) for pointing it out)
- Update to acorn v3.0.4

04-Feb-16 v2.4.0

- Update to [Acorn v2.7.0](https://github.com/ternjs/acorn/commit/1405436064bff087f14af55a763396aa5c0ca148). This tightens up the parsing of some ES6 edge cases and could possibly [break](https://github.com/ternjs/acorn/pull/317) old ES5 sloppy mode code  
- Implement 'eager' evaluation for 'ES7' mode (promises & generators always were eager).

02-Feb-16 v2.3.11-v2.3.13

- Fix issue where different versions of nodent attempt to use different loggers
- Fix typo in mapCondOp
- Improve compiler performance (approx 25%)
- Fix issues related to the generation of nested FunctionDeclarations in ES5-Strict mode
- Re-implement mapLogicalOps & mapCondOps to generate correct code for expressions like `a || b && await c`. Previous version produced code that wouldn't run.
- Allow the option `{log:false}` instead of a no-op function
- Correctly place directives at the top of the Program/function when hoisting declarations.
- Thanks to https://github.com/epoberezkin for the additional test cases and enhancements

17-Dec-15 v2.3.10

- Provide the cover 'asyncfunction' which implements the type `AsyncFunction` to dynamically compile and create asynchronous functions.

16-Dec-15 v2.3.9

- Correct cases where arrow functions contain deeply nested expressions containing await and logical/conditional operators
- Fix edge cases in code output (sparse array constants, object pattern precedence, generator member functions), add everything.js syntax tests

10-Dec-15 v2.3.7

- Correctly asynchronize ES6 `for...in` loops.
- Update the plugin code to remove 'async' and 'await' from the super-strict keyword tests introduced in acorn v2.6.x that generate parse errors before the plugin gets a chance to manage them. Also compatible with acorn v2.5.2 as used by previous versions of nodent.
- Remove spurious 'debugger' statement, fix case where for..in body is a single expression.

09-Dec-15 v2.3.5

- Correctly asynchronize ES6 `for...of` loops.

08-Dec-15 v2.3.4

- Mark ArrowFunctionExpression containing a BlockStatement as having a scope (it does in Chrome 46) to constrain hoisting of variables declared inside Arrow Functions
- Correct 'return undefined' suppression in object/class methods (as well as normal functions)
- Numerous fixes to make Babel-style Object/ClassMethod play nicely with the ESTree Property & MethodDefinition (v2.3.1-2.3.3)

07-Dec-15 v2.3.0

- Implement version-aware in-process JS compiler so modules built with different versions of nodent can co-exist
- Implement wrapAwait option to allow for the `await nonPromise` edge-case enabled in the standard implementation
- Implement 'optionSets' for each `use nodent` directive and allow their specification in the package.json to avoid use unnecessary use of setDefaultCompileOptions() and the consequent dependency between code and environment.
- Implement labeled `break` and `continue` containing `await`
- Only suppress the automatic insertion of `return undefined` if a function uses `async return` or `async throw`. Other async functions now return `undefined` asynchronously if the run to completion.

04-Dec-15: v2.2.10

- Fix error that mangled the declaration of a `let` statement under certain conditions

24-Nov-15: v2.2.9

- Report the original filename being parsed in handling SyntaxError from acorn.
- Only warn about for...in/of loops if they contain an `await`

23-Nov-15: v2.2.8

- Fix case where `await` inside a non-async arrow function attempted to evaluate the await outside of the function body. Create the test case es6-object-arrow to catch this case.

12-Nov-15: v2.2.7

- Correctly bind 'Finally' so that 'this' is maintained in success cases
- Return initialize from setDefaultCompileOptions() so the statement `nodent = require('nodent').setDefaultCompileOptions(...)()` works
- Fix implementation of Object.isThenable

06-Nov-15: v2.2.6

- Fix incorrect 'async' value on AST Property and correctly use the Property.value.async for full compliance with the ESTree spec.
- Update to acorn-es7-plugin 1.0.9 (fixes source location for async and await, and adds tests thanks to @jamestalmage)

04-Nov-15: v2.2.4

- Support enhanced ESTree constructs as used by Babel v6.x.x for [fast-async](https://www.npmjs.com/package/fast-async) Babel plugin
- Only hoist (scoped) declarations if the scope contains an 'await'.

30-Oct-15: v2.2.2

- Correct case where an ArrowFunctionExpression.body is a SequenceExpression (requires parens), e.g `x => (x,y)`, which is different from `x => x,y`
- Include parentheses in the expression +(+x) to avoid it looking like ++x

29-Oct-15: v2.2.0

- Implement the correct conditional execution semantics for `&& || ?:` whether they contain `await` expressions or not.
- Revert to `'sourceType: 'script'` as 'module' forces 'strict' mode and breaks some existing files. You can override the sourceType (see v2.1.11) if necessary.
- Enable 'import' and 'export' statements, even in 'script' mode. Nodent does nothing with these statements, but simply passes them through to your execution platform or transpiler to implement.
- Add syntax testing to the test suite. This has been tested against over 75,000 .js files and a number of edge cases has been fixed.
- Throw a nodent::map.MapError (derived from Error) if the `map` cover encounters an error, or one of the delegates does when `throwOnError:true`

25-Oct-15: v2.1.11

- Fix a number of errors related to the output ES6 `import` and `export` statements
- Change the default parsing sourceType from 'script' to modules. Use `nodent.setDefaultCompileOptions({parser:{sourceType:'script'})` to switch back.
- Correct parenthesis on CallExpression & MemberExpression and some other precedence edge cases
- Add syntax tests

22-Oct-15: v2.1.10

- Expose acorn parser options to allow for 'module' parsing in browserifyu-nodent
- Correct 'writable' descriptor so that the fast-async can ship the function binder on each file (ugly, but there's no way to include a runtime from a babel plugin)

21-Oct-15: v2.1.9

- Implement correct async semantics for 'finally' clause, add try/catch/finally tests
- Fix case where 'finally' block is not followed by any code at all
- Fix 'double exception' case where $Catch threw both synchronous and asynchonously.
- Fix 'async return;' (with no argument) in generator mode
- Separate es5 and es6 parser tests (since tests/parser.js used to fail on node<4.0.0)

08-Oct-15: v2.1.3

- Rationalise CLI option parsing. Allow javascript/ast from stdin
- Fix get/set method output
- Fix method async get _() {}
- Error on method async set _() {}

06-Oct-15: v2.1.0

- BREAKING CHANGE: The ES7 extensions _return async ..._ and _throw async ..._ have been changed to `async return...` and `async throw...`. This was necessary as the inability to parse 'return async function()...' unambiguously is (clearly) a mistake. If you have a large body of code using the previous syntax extension, stick to v2.0.x or earlier, however it is typically a simple search-and-replace (it was in all our code).
- `async` is now only a keyword in the correct contexts, specifically before a function declaration, function expression, arrow function or member function. Elsewhere it is parsed as an identifier (i.e. a variable, named function, etc.). This change has been made to be closer to the ES7 specification for 'async'.
- `await` is now only a keyword in the correct contexts, specifically inside an `async` function body (or arrow expression). This change has been made to be closer to the ES7 specification for 'await'. Additionally, outside of an `async` function body, nodent allows `await` where it cannot be an identifier. In practice this means almost everywhere, except when the argument to `await` is parenthesized, i.e. from a standard function you can `await x` (as before, with a warning), but you cannot `await (x)` as it parses as a function call to a a function called 'await'. Nodent translates 'await' outside a function into a ".then(...)" call.
- Added the `asyncStackTrace` environment option, which shows the current stack and the async caller (if available).

02-Oct-15: v2.0.4

- Add --pretty to cli (output input, no transformation)
- Add [] as a final option to .noDentify() to forward all arguments to the callback to the awaiting call (useful for very non-standard callbacks that split results across parameters)
- Include the first line of the async stack trace (usually the message)
- Add 'npm test' script Rationalise x-* tests Add asyncify test

29-Sep-15: v2.0.2

- Add --sourcemap option to command line
- Tidy up stack trace mapping
- Add option throwOnError to covers/map (and test case)
- Remove extraneous line end after "debugger;" statement
- Only set EventEmitter.prototype.wait once (since covers can now be re-instantiated)

27-Sep-15: v2.0.1

- Fix case where `if (x) return await y ;` incorrectly evaluated the `await` before the test.

23-Sep-15: v2.0.0. Initial release of Nodent v2.x.x., which has moved from UglifyJS to the acorn parser and the ESTree AST representation, mainly for performance and to support ES6 targets such as Node v4.x.x. See "upgrading" below.

Upgrading
---------
v2.1.x BREAKING CHANGE

The ES7 extensions _return async ..._ and _throw async ..._ have been changed to `async return...` and `async throw...`. This was necessary as the inability to parse 'return async function()...' unambiguously is (clearly) a mistake. If you have a large body of code using the previous syntax extension, stick to v2.0.x or earlier.  

Nodent v2.0.0 is a major update. There may be some breaking changes. Significant changes are:

* Moved from Uglify2 to Acorn for input parsing, and re-written much of tree manipulation
* Supports ES6 input syntax, so suitable for adding async & await to ES6 code in Node v4.x.x
* Additional tests for interoperability between -es7, -promises and -generator mode
* Cleaner options for code generation and configuration.
* The old (<v1.0.38) ES5 assignment operator "<<=" and "async-function" syntax is no longer supported.
* The compiler always uses the Thenable protocol, even in -es7 mode, to ensure interoperability
* Additional ES5/6 constructs are available such as object/class method definitions and getters can be marked `async`
* ES6 constructs like arrow functions (and async arrows) and `super` are supported
* `arguments` is correctly mapped into async function bodies and no longer refer to the $return and $error parameters
* Generator mode falls back to Promises mode to implement the non-ES7 standard extensions `async return expression`, `async throw expression` and `await` outside of an `async` function.
