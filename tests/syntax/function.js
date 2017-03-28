function f(a, b, c) {
	return null;
}
var g = function (a, b, c) {
	return null;
};
function h(a, b = 1, c = 2) {
	return null;
}
function i(a = 1, b, c) {
	return null;
}
function j(...a) {}
function k() {}
var l = function () {};
var m = function (a = 1, b, c) {};
function* f() {
	yield 42;
}
function* g() {
	yield 42;
	yield 7;
	return "answer";
}
let h2 = function* () {};
let f2 = (a) => a;
let g2 = (a, b) => a + b;
let h3 = (a, b = 0) => a + b;
let i2 = (a, b) => {};
let j2 = () => {};
let k2 = () => ({});
let l2 = () => {
	let a = 42;
	return a;
};
let m2 = () => ({
	a: 1,
	b: 2
});
