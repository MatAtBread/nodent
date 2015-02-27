/** NB: Fails unless 'continue' is supplied **/

async function nop() {
    return;
}

async function test() {
  var s = "" ;
  for (var n=0;n<10;n++) {
    if (n>5) {
        await nop() ;
        continue;
    }
    test() ;
    s += "." ;
  }
  return s.length==6 ;
}

module.exports = test ;
