"use strict";

var fs = require("fs");

suite("parsing", function() {
  test("can be parsed and evaluated without error by node", function() {
    require("..");
  });
  test("can be parsed by esprima", function() {
    var programText = "" + fs.readFileSync(require.resolve(".."));
    require("esprima").parse(programText);
  });
});
