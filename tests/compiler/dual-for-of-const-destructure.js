async function nop(x) { return x }

async function b() {
    var n = 0 ;
    for (const {ans:a, z} of [{ans:5,z:10},{ans:3,z:20},{ans:1,z:30}]) {
        n += await nop(a*z) ;
    }
    return n ;
}

return await b() ;
