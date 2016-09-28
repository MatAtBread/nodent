'use strict';

async function nop(x) { return x } 
async function loopScope() {
    var x = -1 ;
    var s = "" ;
    for(let x=0; x<2; x++) {
        s += await nop("ab"[x]);
    }
    for(let x=0; x<2; x++) {
        s += await nop("cd"[x]);
        for(let x=0; x<2; x++) {
            s += await nop("ef"[x]);
        }
        s += await nop("gh"[x]);
    }
    return x === -1 && s === "abcefgdefh" ;
}

return await loopScope();
