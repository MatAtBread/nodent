async function nop(x) { return x }

var a = 123, b = 2, c = await nop(a), d = 3, e = 4 ;

return [
  a,b,c,d,e
].toString() ;
