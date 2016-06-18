"xxx-use strict";

async function inc(m) {
    return m+1 ;
}

async function test(){
    var x = await inc(0) ;
    function y() {
        return x ;
    }
    return y() === 1;
}
module.exports = test ;
