"use strict";

var Thenable = require('./lib/thenable');
var isThenable = require('./lib/isThenable');

module.exports = require('./covers/map')({Thenable: Thenable, isThenable: isThenable});
