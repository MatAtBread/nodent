"use nodent";

async function inc(m) {
    return m+1 ;
}

async function strict(){
    "use strict";
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

    return a==1 && b==2 && c==3 && p==1 ;
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

module.exports = async function() {
    return await strict() && await sloppy() ;
}
