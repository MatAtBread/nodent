async function add(a,b) {
    return a+b;
}

async function test() {
    var x = 0 ;
    for (var n=0;n<5000;n++) {
        if (!(n%1000))
            await breathe() ;
        x = await add(x,1) ;
    }
    return n-x ;
}

module.exports = async function() {
    return await test()==0 ;
}

