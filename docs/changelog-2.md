18-Sep-16 v2.6.7, v2.6.8

- Handle loops with no test condition `for(;;){}`
- Don't attempt to hoist `export`ed named declarations
- Correctly identify Babel types Object/ClassMethod as scopes to avoid illegal mappings

05-Sep-16 v2.6.6

- Fix JS output routine which (incorrectly) removed the asterisk from `yield *`.
- Improve syntax testing to catch differences in primitive values in ASTs

26-Aug-16 v2.6.5

- Fix JS output routine which (incorrectly) removed parenthesis from `a || (()=>b)` causing a precedence problem.

20-Aug-16 v2.6.4

- Fix issue with `for..of` with a `const` or destructuring initializer
- Optimize EagerThenable and guard multiple Promise resolutions

06-Aug 16 v2.6.3

- Fix issue with non-trivial destructuring assignments (fixes https://github.com/MatAtBread/fast-async/issues/8 - thanks to @simonbuchan)
- Fix case where empty "else" block throws an expcetion (fixes https://github.com/MatAtBread/nodent/issues/50 - thanks to @Antender)
- Fix case where single line exported function was incorrectly hoisted with no reference (fixes https://github.com/MatAtBread/fast-async/issues/7 - thanks to @simonbuchan, @naturalethic and @nightwolfz)
- Bump acorn to v3.3.0

20-Jul 16 v2.6.2

- Update acorn-es7-plugin to fix issue with `export async` in webpack
- Fix edge case where a continuation function is treated as a block-scoped

15-Jul 16 v2.6.0

- Optimize case where 'engine' generates an 'awaitAnywhere' Promise-style callback for an async function nested inside a sync function, and `await` is legal.
- Bump version to make support for 'engine' mode easier to detect in toolchains.

14-Jul-16 v2.5.10

- Add 'engine' mode that _only_ transpiles the nodent ES7 extensions (`async get x(){}`, `async throw x`, `async return` and `await` anywhere). Standard ES7 async/await constructs are passed through the compiler unchanged to be run by the underlying engine (e.g. Chrome v53 or Edge v14).
- Implement parsing for proposed ES7 Object spread `var {a,b,...x} = y ;` used in Babel (see https://github.com/MatAtBread/fast-async/issues/6)

08-Jul-16 v2.5.9

- Revert change to runtime inclusion in 2.5.8 as it breaks some live uses of browserify/webpack, and was only included to make istanbul work
- Correctly hoist and implement block scoping for `let`, `const`, etc. Note: the actual mapping attempts to provide the most compatable code since pre-ES6 implementations of `const` differ between JS engines and strict/sloppy mode. It is possible some early code that works on non-standard JS implementations may execute differently or fail to compile. Additionally, use of `let` and `const` is slightly slower is it involves the creation of additional scopes in awaited callbacks.
- Implement dual-mode test for const scoping
- Fix typo in covers/https to prevented get() from working
- Fix path resolution for nodent.require() built-ins
- Fix typos when defining writable Object properties

04-Jul-16 v2.5.7

- Correctly export MapError (for instanceof) as map.MapError

27-Jun-16 v2.5.6

- Correctly bind `this` inside loops if it is referenced (https://github.com/MatAtBread/nodent/issues/39). Many thanks to https://github.com/jeffreylin for the test case and fix.
- Fix command-line option `--use=(mode)` with text input
- Bump acorn-es7-plugin to to 1.0.15

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

