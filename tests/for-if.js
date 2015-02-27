"use nodent-es7";
/** NB: Fails unless 'continue' is supplied **/

async function nop() {
    return;
}

async function test() {
  var s = "" ;
  for (var n=0;n<10;n++) {
    if (n>5) {
        await nop() ;
    }
    s += "." ;
  }
  return s.length==10 ;
}

module.exports = test ;
