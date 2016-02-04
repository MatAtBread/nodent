async function pause() {
    setImmediate(function(){ async return }) ;
}

async function half(x) {
    return x/2 ;
}

async function otherHalf(x) {
    await pause() ;
    return x/2 ;
}

async function test() {
    var a = half(10) ;
    var b = otherHalf(10) ;
    return (await a + await a)===10 && (await b + await b)===10 ;
}

module.exports = test ;
