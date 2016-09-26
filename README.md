[![NPM](https://nodei.co/npm/nodent.png?downloads=true&downloadRank=true)](https://nodei.co/npm/nodent/)

NoDent
======

NoDent is a small module for Nodejs that implements the JavaScript ES7 keywoards `async` and `await`. These make writing, reading and understanding asynchronous and callback methods more implicit and embedded in the language. It works by (optionally) transforming JavaScript when it is loaded into Node.

This README assumes you're using Nodent v3.x.x - see [Upgrading](#upgrading) if your upgrading from an earlier version, and keep an eye out for the asides that look like..

> **v2.x** users - changes between NoDent v2 and v3 are highlighted like this

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

This must take place early in your app, and need only happen once per app - there is no need to `require('nodent')` in more than one file, once it is loaded it will process any files ending in `use nodent` directive at the top of a .js file. 

> **v2.x** users, the '.njs' extension is still supported, but not recommended

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
| --use=_mode_ 		| Ignore any "use nodent" directive in the source file, and force compilation _mode_ to be `es7`,`promises`,`generators`. `engine` or `default`
| --wrapAwait 		| Allow `await` with a non-Promise expression [more info...](#differences-from-the-es7-specification)
| --lazyThenables 	| Evaluate async bodies lazily in 'es7' mode. See the [Changelog](#changelog) for 2.4.0 for more information

Use within your Node scripts
============================
There is no need to use the command line at all if you want to do is use `async` and `await` in your own scripts then just  `require('nodent')()`. Files are transformed if they have a `use nodent` directive at the top, or have the extension ".njs". Existing files ending in '.js' _without_ a `use nodent...` directive are untouched and are loaded and executed unchanged.

ES7 and Promises
----------------
Nodent can generate code that implements `async` and `await` using basic ES5 JavaScript, Promises (via Nodent's built-in library, a third party library or module, or an ES5+/6 platform) or Generators (ES6). Using the directive:

	'use nodent';

The `use nodent` directive uses a default set of compilation options called 'default', which can be modifed in your [package.json](#advanced-configuration).

Within your package.json, you can have named sets of pre-defined options, which individual files can refer to if necessary. There are four pre-defined sets of options: promises, es7, generators and engine.

	'use nodent-promises';
	'use nodent-es7';
	'use nodent-generators';
	'use nodent-engine';

### Which one should you use?
All the implementations work with each other - you can mix and match. If you're unsure as to which will suit your application best, or want to try them all out `'use nodent';` will use a 'default' configuration you can determine in your application's package.json. See [Advanced Configuration](#advanced-configuration) for details.

#### Shipping a self-contained app to a browser, Node <=0.10.x or other unknown environment
`use nodent-es7` - it's the most compatible as it doesn't require any platform support such as Promises or Generators, and works on a wide range of desktop and mobile browsers.

#### Shipping an app or module within Node, npm or [modern browsers supporting Promises](http://kangax.github.io/compat-table/es6/#test-Promise)
`use nodent-promises` provides the most compatibility between modules and apps. If your module or library targets Node earlier than v4.1.x, you should install a Promise library (e.g. rsvp, when, bluebird) or use `nodent.Thenable` to expose the Promise API.

> **v2.x** users: `nodent.EagerThenable()` is still defined, but as of v3 is the same as the `Thenable` implementation.

#### Generators
`use nodent-generators` generates code which is reasonably easy to follow, but is best not used for anything beyond experimentation as it requires an advanced browser on the client-side, or Node v4.x.x. The performance and memory overhead of generators is poor - currently (Node v6.6.0) averaging 3.5 times slower compared to the es7 with 'lazyThenables'.

#### Engine
`use nodent-engine` does _not_ transpile standard ES7 async/await constructs, but only transpiles the additional non-standard features provided by nodent - await anywhere, async getters, async return and throw. At the time of writing, not many runtimes implement async and await - Chrome v53 does with command line flags, and Edge 14 are examples. On Chrome, performance is better than generators, but not quite as good as Promises, and still less than half the speed of ES7 mode.

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
		engine:<boolean>,		// Compile in engine mode (like 'use nodent-engine')
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
		// Maybe log the error somewhere
		throw ex ;
	};

Further information on using Nodent in the browser can be found at https://github.com/MatAtBread/nodent/issues/2.

Other options: Babel & Browserify
-------------
You can also invoke nodent from browserify as a [plugin](https://www.npmjs.com/package/browserify-nodent), or as an alternative, [faster implementation than](https://www.npmjs.com/package/fast-async) than Babel's [transform-async-to-generator](http://babeljs.io/docs/plugins/transform-async-to-generator/)

Async and Await syntax and usage
======================

You can find out more about defining and calling async functions [here](./docs/syntax.md). There's plenty on the web too.

Gotchas and ES7 compatibility
===========================

Async programming with Nodent (or ES7) is much easier and simpler to debug than doing it by hand, or even using run-time constructs such as Promises, which have a complex implementation of the their own when compiled to ES5. However, a couple of common cases are important to avoid.

Differences from the ES7 specification
--------------------------------------

You can continue to use all the Nodent extensions with async/await capable engines. In the `use nodent-engine` mode, all ES7 standard async/await constructs are passed through unchanged, and only functions that use a Nodent extension are transformed.

Extensions to the specification:

* **async getters**

	Nodent permits a class or object definition to define async getters:

		async get data() { ... }
		get async data() { ... }

	This syntax is currently not supported by any other ES7 parsers and must be substituted with something an internal async IIFE:

		get data() { return (async function(){
			...
		})() }

	Nodent logs a warning when it detects this situation.

* **await outside async**

	The ES7 async-await spec states that you can only use await inside an async function. This generates a warning in nodent, but is permitted. The synchronous return value from the function is compilation mode dependent. In practice this means that the standard, synchronous function containing the `await` does not have a useful return value of it's own.

* **async return/throw**

	The statements `async return <expression>` and `async throw <expression>` are proposed extensions to the ES7 standard (see https://github.com/lukehoban/ecmascript-asyncawait/issues/38). The alternative to this syntax is to use a standard ES5 declaration returning a Promise. See [below](#exiting-async-functions-from-callbacks) for details.

Known differences from the specification:

* **AsyncFunction**

	The [`AsyncFunction`](#asyncfunction) type is _not_ defined by default, but is returned via the expression `require('nodent')(...).require('asyncfunction')`. The `AsyncFunction` constructor allows you to create async functions on the fly, much as the standard `Function` constructor does.

* **case without break**

	As of the current version, `case` blocks without a `break;` that fall thorugh into the following `case` do not transform correctly if they contain an `await` expression. Re-work each `case` to have it's own execution block ending in `break`, `return` or `throw`. Nodent logs a warning when it detects this situation.

* **await non-Promise**

	The ES7 specification allows an application to `await` on a non-Promise value (this occurs because the template implementation wraps every generated value in a Promise). So the statement:

		var x = await 100 ; // 100

	...is valid. Nodent, by default, does _not_ allow this behaviour (you'll get a run-time error about '100.then is not a function'. Generally, this is not a problem in that you obviously only want to wait on asynchronous things (and not numbers, strings or anything else). However, there is one unpleasant edge case, which is where an expression _might_ be a Promise (my advice is to never write code like this, and avoid code that does).

		var x = await maybeThisIsAPromise() ;

	In this case, the expression will need wrapping before it is awaited on by Nodent. You can emulate this behaviour by specifying the code-generation flag 'wrapAwait' in your package.json or after the nodent directive:

		'use nodent {"wrapAwait":true}';

	Wrapping every value in a Promise increases the time taken to invoke an async function by about 20%. An alternative to
  wrapping everything is to only wrap expression where this might be the case explicitly:

		var x = await Promise.resolve(maybeThisIsAPromise()) ;

  or
  
		var isThenable = require('nodent').isThenable ;
			...
    	var x = maybeThisIsAPromise() ;
    	if (isThenable(x))
      		x = await x ;
      		
  The second implementation avoid the expense (20%) of wrapping every return value in a Promise, with the expense of testing if it is a Promise before awaiting on it.

* **lazyThenables**

	> **v2.x** users - lazyThenables are _only_ available in -es7 mode in v3, and the nodent.Thenable implementation is _not_ lazy, as it was in v2.x.

	Invoking an async function _without_ a preceding `await` (simply by calling it) executes the function body but you can't get the result. This is useful for initiating 'background' things, or running async functions for their side effects. This is in compliance with the ES7 specification.  

	However, this has a performance overhead. For maximum performance, you can specify this code generation option in `use nodent-es7 {"lazyThenables":true}` mode. In this case mode, if you call the async function the body _is not actually executed_ until resolved with an `await` (or a `.then()`). If you know your code always uses `await`, you can use this option to improve performance.

	In `use nodent-promises` mode, it is the implementation of the Promise that determines the execution scheduling and performance. The table below is a summary of modes and execution semantics. You can test the performance on your own hardware with the following command. Note the relative performance is a worst case, since the test does nothing other than make async calls in a loop.

		./nodent.js tests --generators tests/semantics/perf.js

| Mode | Flags / Implementation | Lazy / Eager | Possibly sync resolution | Performance (relative) |
|------|----------|----|--------------------------|------------------------|
| es7 | lazyThenable | Lazy | Yes | 1.0
| es7 | (none)| Eager | No | 1.7x slower
| promises | nodent | Eager | No | 1.7x slower
| promises | node 6.6 native | Eager | No | 5.2x slower
| promises | bluebird 3.4.6 | Eager | No | 2.0x slower
| promises | rsvp 3.3.1 | Eager | No | 2.2x slower
| promises | when 3.7.7 | Eager | No | 1.6x slower
| generators | nodent | Eager | No | 7.5x slower
| generators | node 6.6 native | Eager | No | 15.0x slower
| generators | bluebird 3.4.6 | Eager | No | 8.5x slower
| generators | rsvp 3.3.1 | Eager | No | 7.6x slower
| generators | when 3.7.7 | Eager | No | 8.3x slower

All other JavaScript ES5/6/2015 constructs will be transformed as necessary to implement `async` and `await`.

> **v2.x** users - note the timings and execution semantics for Thenable (and EagerThenable) have changed: they are now fully Promise/A+ compliant, meaning they resolve asynchronously and evaluate eagerly. Only -es7 lazyThenable mode might resolve synchronously.

Exiting async functions from callbacks
---------------------------------------

Specifically in Nodent (not specified by ES7), you can interface an ES7 async function with a old style callback-based function. For example, to create an async function that sleeps for a bit, you can use the standard setTimeout function, and in its callback use the form `async return <expression>` to not only return from the callback, but also the surrounding async function:

	async function sleep(t) {
	    setTimeout(function(){
	    	// NB: "async return" and "async throw" are NOT ES7 standard syntax
	    	async return undefined;
	    },t) ;
	}

[_TRY-IT_](http://nodent.mailed.me.uk/#async%20function%20sleep%28t%29%20{%0A%20%20%20%20setTimeout%28function%28%29{%0A%20%20%20%20%20%20%20%20%2F%2F%20NB%3A%20%22return%20async%22%20and%20%22throw%20async%22%20are%20NOT%20ES7%20standard%20syntax%0A%20%20%20%20%20%20%20%20async%20return%20undefined%20%3B%0A%20%20%20%20}%2Ct%29%20%3B%0A})

Similarly, `async throw <expression>` causes the inner callback to make the container async function throw an exception. The `async return` and `async throw` statements are NOT ES7 standards (see [https://github.com/tc39/ecmascript-asyncawait/issues/38](https://github.com/tc39/ecmascript-asyncawait/issues/38)). If you want your code to remain compatible with standard ES7 implementations when the arrive, use the second form above, which is what nodent would generate and is therefore ES5/6/7 compatible.

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
|engine|boolean|set by the directive `use nodent-engine`
|wrapAwait|boolean|default: false [more info...](#differences-from-the-es7-specification)
|sourcemap|boolean|default:true - generate a source-map in the output JS
|parser|object|default:{sourceType:'script'} - passed to [Acorn](https://github.com/ternjs/acorn) to control the parser
|mapStartLine|int|default:0 - initial line number for the source-map
|generatedSymbolPrefix|string|used to disambiguate indentifiers created by the compiler

The members $return, $error, $arguments, $asyncspawn, $asyncbind, $makeThenable represent the symbols generated by the compiler. You could change them to avoid name clashes, but this is not recommended.

When determining what options to use when compiling an individual file, nodent follows the sequence:

* Use the set specified after the `use nodent-` directive. For example `use nodent-promises` uses a predefined set called 'promises'. Other predefined sets are 'es7', 'generators' and 'engine'. If the `use nodent` doesn't have a name, the internal name "default" is used.

* Apply any modifications contained within the package.json containing your module or application. The package.json can (optionally) contain a 'nodent' section to define your own sets of options. For example, to create a set to be used by files containing a `use nodent-myapp` directive:

		"nodent":{
			"directive":{
				"myapp":{
					"promises":true,
					"wrapAwait":true
				}
			}
		}

	You can also set options for the pre-defined sets here (default, es7, promises, generators, engine).
	
	> **v2.x** users - Until v2.5.4, Nodent would typically look for your application's package.json. All later versions use the installation location of the calling code, so an application, module and sub-module can all have their own settings and defaults.

* Finally, nodent applies any options specified _within_ the directive, but after the name. The options are strict JSON and cannot be an expression. This is useful for quickly testing options, but is probably a bad idea if applied to very many files. One exception is rare use of the `wrapAwait` options, which has a performance overhead and few genuine use-cases. For example, to create the same effect as the 'myapp' set above:

		'use nodent-promises {"wrapAwait":true}';

You can programmatically set these options _before_ creating the nodent compiler (but after requiring nodent) by using the setDefaultCompileOptions() and setCompileOptions() API calls, however it is more flexible and less likely to clash with another module if you use the techniques above.

Within a nodented file, the special symbol `__nodent` is expanded out to the current option set. It is not a variable and cannot be assigned to - it is an object literal. This has few useful use-cases, except for testing. An example is [here](https://github.com/MatAtBread/nodent/blob/master/tests/semantics/await.wrap.js)

API
===
Create an instance of a nodent compiler:

	var nodent = require('nodent')(options);

Options:

| Member             | Type   |                        |
|--------------------|--------|------------------------|
| dontMapStackTraces |boolean | default: false
| augmentObject      |boolean | Adds `asyncify(PromiseProvider)` and `isThenable()` to Object.prototype, making expressions such as `var client = new DB().asyncify(Promise)` and `if (abc.isThenable()) await abc()` less verbose
| extension          | string | extension for files to be compiled (default: '.njs'). Note that this is unused if the file has a `use nodent-` directive.
| log(msg)           |function| Called when nodent has a warning or similar to show. By default they are passed to console.warn(). Set this member to change how to record logging, or to `false` to disable logging.

> **v2.x** The flag 'asyncStackTrace' has been removed as modern debuggers can do this better than nodent can. You can specify it, but it is ignored.

Return: a 'nodent' compiler object with the following properties:

| Member             | Type   |                        |
|--------------------|--------|------------------------|
|version|string|The currently installed version|
|asyncify (PromiseProvider)|function|Return a function to convert an object with functions with callbacks to ones with async function members. `asyncify` is also a meta-property (see below)
|Thenable(function) EagerThenable()(function)|function|Nodent's in-built Promise implementation. `Thenable` is also a meta-property (see below)
|require(moduleName,options)|object|Import an async helper module|
|generateRequestHandler(path, matchRegex, options)|function|Create a function use with Express or Connect that compiles files for a browser on demand - like a magic version of the 'static' middleware
|isThenable (object)|boolean|Return boolean if the supplied argument is Thenable (i.e. has an executable `then` member). All Promises, `nodent.EagerThenable()` and `nodent.Thenable` return true
|$asyncbind|function|Required runtime in ES7/Promises mode
|$asyncspawn|function|Required runtime in generator mode

Note the nodent object has other members used for implementation - these are subject to change and are not part of the API.

> **v2.x** users - nodent.Thenable and nodent.EagerThenable() are now full Promises/A+-compliant Promise implementations. There is no external access to the synchronous 'Thenable' used in -es7-lazyThenables mode.


Meta-API
--------
You can over-ride certain defaults and access values that are global to the process (as opposed to module by module) by instantiating nodent _without_ an argument:

	var nodentMeta = require('nodent') ;

The available meta-properties are:

| Member| Type |  |
|-------|-----|------------------------|
|Thenable|function|Nodent's built in Promise/A+ implementation|
|asyncify|object|Method to transform methods from callbacks to async functions by wrapping in Promises|
|setDefaultCompileOptions (compiler[,env])|function|Set the defaults for the compiler and environment. This should be called before the first compiler is created. The default environment options (`log augmentObject extension dontMapStackTraces asyncStackTrace`) will be used when the corresponding option is missing when the compiler is created. The compiler options (`sourcemap` and default symbol names) must be set before the first compiler is created. The other compilation options (`es7 promises generators engine`) are set by the corresponding directive|
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

Nodentify has a small set of covers for common Node modules. More information can be found [here](./docs/helpers.md)

Testing
=======

Nodent has a test suite (in ./tests) which is itself a node package. Since it requires a bunch of Promise implementations to test against, it is NOT installed when 'nodent' is installed. The Promise implementations are option - you can run the tests using the nodent.Thenable and native Promises (if available) without installing any other modules. To run the tests:

	npm test

If you want to run the tests against some popular Promise libraries:

	cd tests
	npm install
	cd ..
	./nodent.js tests

The test runner in tests/index.js accepts the following options:

	./nodent.js tests [OPTIONS] [test-files]

	--quiet      	Suppress any errors or warnings
	--quick      	Don't target a specific execute time, just run each test once
	--nogenerators 	Performance test syntax transformations only, not generators
	--genonly	 	Only run the performance tests for generator mode
	--engine		Performance test the underlying engine's support for async and await (e.g. Chrome v53 with flags)
	--syntax	 	Check the parser/output code before running semantic tests
	--syntaxonly	Only run syntax tests
	--forceStrict	Run the tests with a 'use strict' inserted at the top of every test file

> **v2.x** users - The flag --generators has been replaced by --nogenerators, which has the opposite sense.

Performance
-----------

Run the test script without the `--quick` option to see how nodent code performs in ES7 mode, Promises, generators and engine on your platform. The specific 'perf' test just calls and awaits in a tight loop:

	./nodent.js tests --generators --engine tests/semantics/perf.js

Additionally, a try the following links to test performance against Babel and Traceur.

[nodent](http://nodent.mailed.me.uk/#function%20pause()%20%7B%0A%20%20%20%20return%20new%20Promise(function%20(%24return%2C%20%24error)%20%7B%0A%20%20%20%20%20%20%20%20setTimeout(%24return%2C%200)%3B%0A%20%20%20%20%7D)%3B%0A%7D%0A%0Aasync%20function%20doNothing()%20%7B%0A%20%20%20%20return%3B%0A%7D%0A%0Aasync%20function%20test()%20%7B%0A%20%20%20%20var%20t%20%3D%20Date.now()%3B%0A%20%20%20%20for%20(var%20j%20%3D%200%3B%20j%20%3C%20100%3B%20j%2B%2B)%20%7B%0A%20%20%20%20%20%20%20%20for%20(var%20i%20%3D%200%3B%20i%20%3C%201000%3B%20i%2B%2B)%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20await%20doNothing()%3B%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20await%20pause()%3B%0A%20%20%20%20%7D%0A%20%20%20%20return%20Date.now()%20-%20t%3B%0A%7D%0A%0Atest().then(alert)%3B%0A) 356ms

[babel](http://babeljs.io/repl/#?babili=false&evaluate=true&lineWrap=false&presets=stage-2&experimental=true&loose=false&spec=true&playground=false&code=function%20pause()%20%7B%0A%20%20%20%20return%20new%20Promise(function%20(%24return%2C%20%24error)%20%7B%0A%20%20%20%20%20%20%20%20setTimeout(%24return%2C%200)%3B%0A%20%20%20%20%7D)%3B%0A%7D%0A%0Aasync%20function%20doNothing()%20%7B%0A%20%20%20%20return%3B%0A%7D%0A%0Aasync%20function%20test()%20%7B%0A%20%20%20%20var%20t%20%3D%20Date.now()%3B%0A%20%20%20%20for%20(var%20j%20%3D%200%3B%20j%20%3C%20100%3B%20j%2B%2B)%20%7B%0A%20%20%20%20%20%20%20%20for%20(var%20i%20%3D%200%3B%20i%20%3C%201000%3B%20i%2B%2B)%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20await%20doNothing()%3B%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20await%20pause()%3B%0A%20%20%20%20%7D%0A%20%20%20%20return%20Date.now()%20-%20t%3B%0A%7D%0A%0Atest().then(alert)%3B%0A) 1072ms - more than 3x slower

[traceur](https://google.github.io/traceur-compiler/demo/repl.html#%2F%2F%20Options%3A%20--async-functions%20--source-maps%20%0Afunction%20pause()%20%7B%0A%20%20%20%20return%20new%20Promise(function%20(%24return%2C%20%24error)%20%7B%0A%20%20%20%20%20%20%20%20setTimeout(%24return%2C%200)%3B%0A%20%20%20%20%7D)%3B%0A%7D%0A%0Aasync%20function%20doNothing()%20%7B%0A%20%20%20%20return%3B%0A%7D%0A%0Aasync%20function%20test()%20%7B%0A%20%20%20%20var%20t%20%3D%20Date.now()%3B%0A%20%20%20%20for%20(var%20j%20%3D%200%3B%20j%20%3C%20100%3B%20j%2B%2B)%20%7B%0A%20%20%20%20%20%20%20%20for%20(var%20i%20%3D%200%3B%20i%20%3C%201000%3B%20i%2B%2B)%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20await%20doNothing()%3B%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20await%20pause()%3B%0A%20%20%20%20%7D%0A%20%20%20%20return%20Date.now()%20-%20t%3B%0A%7D%0A%0Atest().then(alert)%3B%0A) 1175ms - more than 3x slower

The example timings are from Chrome v53 on Mac OSX. I get even wider results with Firefox, and dramatically wider results on mobiles (nodent ES7 mode is upto 10x faster than generators and transpilers).

The test is a simple set of nested loops calling async functions that don't do much. The purpose is to illustrate the overhead generated in the transpilation by each compiler. In reality, you'd be crazy to use async calls for everything, but very well advised to use them for I/O bound operations (network, disks, etc). In these cases, you can be reasonably certain that the overhead generated by the compilers would be small in comparison to the actual operation....but it's nice to know you're not wasting cycles, right? For those who want to know why, the real reason is the use of generators (the suggested implementation in the ES7 async/await specification), which are inefficient natively (about 50% slower than using 'nodent-promises'), and even worse when transcompiled into ES5.

Upgrading
---------
v3.0.0

Nodent v3 is a significant update. Major changes are:

* The Promise implementation used by Nodent by default is based on the most excellent [Zousan](https://github.com/bluejava/zousan) Promise implementation. After a lot of looking around and testing, Zousan proved to be one of the smallest and fastest around - small enough to fit 
into Nodent's runtime and faster in many cases than Bluebird and when.

* Promises are now the default execution mode. Only -es7 with lazyThenables uses the synchronous Thenable protocol. This is only retained for speed in exceptional cases. In almost all practical applications (i.e. using async functions to handle IO of some sort), the overhead is around 20% _per call_, meaning it is trivial compared to the IO operation. Nodent syntax-transformation remains around 3-4 times faster than both native generators and libraries like regenerator.

* The use of Promises/A+ compliant execution means the loop asynchronisation used in Nodent v2 can be unwound. Specifically, `for`, `while` and `do...while` loops in Nodent v2 were recursive if the loop didn't yield control to an async operation. This meant that you could run out of stack on relatively trivial loop. For example:

```
for (var i=0; i<cache.length; i++) {
	if (cache[i].entry === null)
		cache[i].entry = await readNetworkResult() ;
}
```

This loop would appear to run fine while the cache hadn't been emptied, or was no more than a few hundred items long. However, if the test for 'emptiness' was never met, and the cache was thousands of items long, because the loop _could_ be asynchronous, it would recurse deeply and cause the process to exit with a stack overflow.

Nodent v3 doesn't use recursion (it uses a trampoline), but in doing so it requires Promise chaining, which was not supported by nodent Thenables.

Nodent will still generate potentially recursive loops if you specify `use nodent-es7 {"lazyThenables":true}` since the basic lazy Thenable (while small and very fast) doesn't support chaining. 

This execution case was pointed out by https://github.com/jods4 - many thanks.

Changelog
==========

27-Sep-16 v3.0.0 [see above](#upgrading)

27-Sep-16 v2.6.10

- Remove unecessary global declaration of printNode

25-Sep-16 v2.6.9

- Update acorn-es7-plugin to handle `async(()=>0)`
- Fix case where generator mode generated an illegal anonymous FunctionDefintion from an ArrowFunctionExpression that was never in an expression

(Older changes...)[docs/changelog-2.md)

