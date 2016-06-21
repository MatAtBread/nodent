async function inc(m) {
    return m+1 ;
}

async function sloppy(){
    const p = await inc(0) ;
    var a = p ;
    if (true) {
        const p = await inc(1) ;
        var b = p ;
        if (true) {
            const p = await inc(2) ;
            var c = p ;
        }
    }

    return a==1 && b==2 && c==3 && p==3 ;
}

//if (+process.versions.v8.split('.')[0] != 4) {
    module.exports = sloppy;
//} else {
//    module.exports = async function() { return true } ;
//}
