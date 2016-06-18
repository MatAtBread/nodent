async function inc(m) {
    return m+1 ;
}

async function test(){
    const p = await inc(0) ;
    let q = p ;
    function y() {
        return p ;
    }
    return y() === q;
}
module.exports = test ;
