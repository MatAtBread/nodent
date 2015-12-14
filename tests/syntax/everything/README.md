everything.js
=============

A single javascript file that contains every ECMA-262 grammatical production.

### Usage Example

Mocha:

```js
test("exercise my program", function(done) {
  fs.readFile(require.resolve("everything.js"), function(err, programText) {
    var program = esprima.parse("" + programText);
    assert.equal(runMyProgramOn(program), /* expected value */, "message");
    done();
  });
});
```

### Further ECMAScript Version Support

Support has been added for ECMAScript 2015. Version can be specified through
`require.resolve("everything.js/<version>")`, where `<version>` is one of:

* `es5`: ECMASCript 5.1
* `es2015-module`: ECMAScript 2015 module
* `es2015-script`: ECMAScript 2015 script
