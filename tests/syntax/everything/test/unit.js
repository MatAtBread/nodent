"use strict";

var assert = require("assert");
var fs = require("fs");

var programText = "" + fs.readFileSync(require.resolve(".."));

suite("unit", function() {
  test("contains all whitespace characters", function() {
    assert.notEqual(-1, programText.indexOf("\u0009"), "tab");
    assert.notEqual(-1, programText.indexOf("\u000B"), "vertical tab");
    assert.notEqual(-1, programText.indexOf("\u000C"), "form feed");
    assert.notEqual(-1, programText.indexOf("\u0020"), "space");
    assert.notEqual(-1, programText.indexOf("\u00A0"), "non-breaking space");
    assert.notEqual(-1, programText.indexOf("\uFEFF"), "byte order mark (BOM)");
  });
  test("contains all newline characters", function() {
    assert.notEqual(-1, programText.indexOf("\u000A"), "line feed");
    assert.notEqual(-1, programText.indexOf("\u000D"), "carriage return");
    assert.notEqual(-1, programText.indexOf("\u2028"), "line separator");
    assert.notEqual(-1, programText.indexOf("\u2029"), "paragraph separator");
  });
  test("contains identifier joining characters", function() {
    assert.notEqual(-1, programText.indexOf("\u200C"), "ZWNJ");
    assert.notEqual(-1, programText.indexOf("\u200D"), "ZWJ");
  });
});
