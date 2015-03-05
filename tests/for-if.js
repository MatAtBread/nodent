"use nodent-es7";

var nops = 0 ;
async function nop() {
	nops++ ;
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
  return s.length==10 && nops==4;
}

module.exports = test ;
