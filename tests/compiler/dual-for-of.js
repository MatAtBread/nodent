

async function nop(x) { return x }

var n = 0 ;
for (var a of [{ans:5,z:10},{ans:3,z:20},{ans:1,z:30}]) {
    n += await nop(a.ans*a.z) ;
}
return n ;
