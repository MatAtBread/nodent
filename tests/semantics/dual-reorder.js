async function nop(x) { return x }

var a,b,c ;

return [await nop((a=2,b=await nop(a*3),c=b)),a,b,c].toString()