/* this file contains all grammatical productions in ECMA-262 edition 5.1 ** * **/

import i0 from "module";
import * as i1 from "module";
import {} from "module";
import { i2, a as i3, } from "module";
import i4, * as i5 from "module";
import i6, {} from "module";
import i7, { i8, var as i9 } from "module";
import "module";

export * from "module";
export {} from "module";
export { i0, i1 as a, i2 as var, } from "module";
export {};
export { i3, i4 as in };
export var e5, e6 = 0;
export let e7, e8 = 0;
export const e9 = 0, e10 = 0;
export function e11(){}
export function* e12(){}
export class e13 {}
export class e14 extends e15 {}
export default function e16(){}
// Unfortunately (for us), we can only have a single default export.
/*
export default function (){}
export default function* i16(){}
export default function* (){}
export default class i17 {}
export default class i18 extends i19 {}
export default class {}
export default x = 0;
export default 0;
export default (0, 1);
*/

// whitespace
tab:for(;;)break	tab;
verticalTab:for(;;)breakverticalTab;
formFeed:for(;;)breakformFeed;
space:for(;;)break space;
nbsp:for(;;)break nbsp;
bom:for(;;)break﻿bom;

// line terminators
lineFeed:0
0;
carriageReturn:00;
carriageReturnLineFeed:0
0;
lineSeparator:0 0;
paragraphSeparator:0 0;

// identifier names
var $, _, \u0078, \u{2F9F9}, x$, x_, x\u0030, x\u{e01d5}, xa, x0, x0a,
  x0123456789, qwertyuiopasdfghjklzxcvbnm, QWERTYUIOPASDFGHJKLZXCVBNM;
// a representative sample of ID_Start and ID_Continue
var 䩶, x󠇕, œ一, ǻ둘, ɤ〩, φ, ﬁⅷ, ユニコード, x‌‍;
let letx; let[x\u0078] = 0; const constx = 0;
{ let x; let y = 0; const z = 0; }

null; true; false;

0; 1234567890;
0.; 0.00; 10.00; .0; .00
0e0; 0E0; 0.e0; 0.00e+0; .00e-0;
0x0; 0X0; 0x0123456789abcdefABCDEF;
0b0; 0B0; 0b01; 0b10; 0b10101010;
0o0; 0O0; 0o01234567;
2e308;

""; "'"; "\'\"\\\b\f\n\r\t\v\0";
"\0";
"\x01\x23\x45\x67\x89\xAB\xCD\xEF\xab\xcd\xef";
"\u0123\u4567\u89AB\uCDEF\u00ab\ucdef";
"\uD834\uDF06\u2603\u03C6 \u{0000001F4a9}\u{1D306}\u{2603}\u{3c6} 𝌆☃φ"; "\
";

''; '"'; '\'\"\\\b\f\n\r\t\v\0';
'\0';
'\x01\x23\x45\x67\x89\xAB\xCD\xEF\xab\xcd\xef';
'\u0123\u4567\u89AB\uCDEF\u00ab\ucdef';
'\uD834\uDF06\u2603\u03C6 \u{0000001F4a9} \u{1D306}\u{2603}\u{3c6} 𝌆☃φ'; '\
';

/x/; /|/; /|||/;
/^$\b\B/; /(?=(?!(?:(.))))/;
/a.\f\n\r\t\v\0\[\-\/\\\x00\u0000\uD834\uDF06/; /\u{00000001d306}/u; /\d\D\s\S\w\W/;
/\ca\cb\cc\cd\ce\cf\cg\ch\ci\cj\ck\cl\cm\cn\co\cp\cq\cr\cs\ct\cu\cv\cw\cx\cy\cz/;
/\cA\cB\cC\cD\cE\cF\cG\cH\cI\cJ\cK\cL\cM\cN\cO\cP\cQ\cR\cS\cT\cU\cV\cW\cX\cY\cZ/;
/[a-z-]/; /[^\b\-^]/; /[/\]\\]/;
/./i; /./g; /./m; /./igm;
/.*/; /.*?/; /.+/; /.+?/; /.?/; /.??/;
/.{0}/; /.{0,}/; /.{0,0}/;

`a`; `${0}`; `0${0,1}2`; `0${`1${2}3`}4`;
`\``; `a\${b`; `\0\n\x0A\u000A\u{A}`;

this;

x;

[]; [,]; [0]; [0,]; [,0]; [0,0]; [0,0,]; [0,,0]; [,,];

({}); ({x}); ({x:0}); ({x:0,y:0}); ({x:0,}); ({'x':0,"y":0,in:0});
({
  0: 0, 0.: 0, 0.0: 0, .0: 0, 0e0: 0, 0x0: 0, [0]: 0,
  get x(){}, set x(a){}, get 'y'(){}, set "y"(a){},
  get 0(){}, set 0(a){}, get var(){}, set var(a){},
  get [0](){}, set [0](a){}, [1](){},
  a(){}, 'b'(){}, "c"(){}, 0(){}, .1(){}, 1.(){}, 1e1(){},
  var(a, b = 0, [c,, d = 0, ...e], {f, g: h, i = 0, i: j = 0}, ...k){},
  set in([a, b = 0, [c,, d = 0, ...e], {f, g: h, i = 0, i: j = 0}, ...k]){},
  *d(){}, *'e'(){}, *"f"(){}, *2(){}, *.2(){}, *3.(){}, *2e2(){}, *in(){},
});
({ __proto__: null, get __proto__(){}, set __proto__(a){}, });
({ "__proto__": null, __proto__(){}, });

0..a; 0 .a; (0).a;

0[0];

// this function makes the NewExpression and CallExpression tests not throw at runtime
x = function f(){ return f; }; x[0] = x; x.a = x;

new x(); new new x()();
new x[0](); new x.a(); new x[0].a(); new x.a[0]();
new x; new new x; new new x();
new new x().a; new new x()[0];

x(); x()(); x(x); x(x, x);
x.a().a(); x[0]()[0](); x().a[0]();
x(...[0,1,], ...[], ...function* f(){ return yield 2; });
x`a`; x`0${1}2`;

x++; x--;

delete void typeof+-~!x; ++x; --x;

0*0; 0/0; 0%0;

0+0; 0-0;

0<<0; 0>>0; 0>>>0;

0<0; 0>0; 0<=0; 0>=0;
0 instanceof function(){};
0 in{};

0==0; 0!=0; 0===0; 0!==0;

0&0; 0^0; 0|0; 0&&0; 0||0;

0?0:0; 0?0?0:0:0; 0||0?x=0:x=0;

x=0; x*=0; x/=0; x%=0; x+=0; x-=0;
x<<=0; x>>=0; x>>>=0; x&=0; x^=0; x|=0;

0,0; 0,0,0; x=0,x=0;


{} {;} {0} {0;} {0;0} {0;0;}

var x0; var x1,y2; var x3,y4,z5;
var x6=0; var x7=0,y8; var x9,y10=0; var x11=0,y12=0;

;

if(0); if(0);else;

do;while(0) 0;
do;while(0);
do;while(0) 0
while(0);
for(;;)break; for(0;0;0); for((0 in[]);0;);
for(var a0;;)break; for(var a1,b2;0;0);
for(var a3=0;;)break; for(var a4=(0 in[]);0;);
for(x in{}); for(var x12 in{});
for(x of[]); for(var x13 of[]);

for(;0;)continue; x:for(;0;)continue x;

for(;;)break; x:for(;;)break x;
switch(0){case 0:break;}

function f0(){ return; }
function f1(){ return 0; }

switch(0){} switch(0){case 0:} switch(0){case 0:case 0:}
switch(0){default:} switch(0){case 0:default:case 0:}
switch(0){case 0:;} switch(0){case 0:;;}
switch(0){default:;} switch(0){default:;;}

x:; x:y:;

try { throw 0; }catch(x){}

try{}catch(x){}
try{}finally{}
try{}catch(x){}finally{}

debugger;

function f2(){}
function f3(x){}
function f4(x,y){}
function f5(){ function f6(){} }
{ function f7(){} };
for (;0;) +function f8(){}; 0
do +function f9(){}; while(0)

function f10(a, b = 0, [c,, d = 0, ...e], {f, g: h, i = 0, i: j = 0}, ...k){}
function f11(){ "use strict" }
function f12(){ 'use strict' }
function f13(){ "other directive" }
function f14(){ 'other directive' }
function f15(){ ("string") }
function f16(){ ('string') }
function f17(){
  'string'
  +0
}

function*g0(a, b = 0, [c,, d = 0, ...e], {f, g: h, i = 0, i: j = 0}, ...k){
  return a = yield* b = yield c = yield yield;
}
(function * g1(a, b = 0, [c,, d = 0, ...e], {f, g: h, i = 0, i: j = 0}, ...k){
  return a = yield* b = yield c = yield yield;
})

(function(){});
(function(x){});
(function(x,y){});
(function(){ function f(){} });
(function f(){});
(function f(x){});
(function f(x,y){});
(function f(){ function f(){} });

() => 0;
() => {;}
x => x
x => x = 0
x => y => x
x => {x}
x => ({x});
(x) => x;
(x) => {return x};
(x) => ({x});
({x}) => ({x});
(a, b = 0, [c,, d = 0, ...e], {f, g: h, i = 0, i: j = 0}, ...k) => {;};

[a] = [...[0]];
({a} = {});
try{}catch([e]){}
try{}catch({e}){}

class A {}
class B extends new A {
  constructor(a, b = 0, [c,, d = 0, ...e], {f, g: h, i = 0, i: j = 0}, ...k) {
    super(new.target);
    super()`template`;
    () => super(this);
  }
  m(a, b = 0, [c,, d = 0, ...e], {f, g: h, i = 0, i: j = 0}, ...k) {
    super.m();
    super.m`template`;
    () => super.m(this);
  }

  ;

  static a(){} static 'b'(){} static 0(){} static [0](){}
  static *c(){ yield; } static *"d"() { yield; } static *1(){ yield; } static *[1](){ yield; }
  static var(){} static *in(){}

  static get e(){} static get 'f'(){} static get 2(){} static get [2](){}
  static set g(a){} static set "h"(a){} static set 3(a){} static set [3](a){}
  static get if(){} static set if(a){}

  a(){} 'b'(){} 0(){} [0](){}
  *c(){ yield; } *"d"(){ yield; } *1(){ yield; } *[1](){ yield; }
  var(){} *in(){ yield; }

  get e(){} get 'f'(){} get 2(){} get [2](){}
  set g(a){} set "h"(a){} set 3(a){} set [3](a){}
  get if() {} set if(f) {}
}
class C extends B { "constructor"(){ super(); } }
