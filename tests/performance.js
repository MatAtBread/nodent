async function breathe() {
	setImmediate($return);
}

async function add(a,b) {
    return a+b;
}

async function test() {
  var x = 0 ;
  for (var n=0;n<100000;n++) {
    if (!(n&511)) {
        await breathe() ;
    }
    x = await add(x,1) ;
  }
  return n-x ;
}

module.exports = async function() {
	var t = Date.now() ;
	await test() ;
	return (Date.now()-t)+"ms" ;
}

