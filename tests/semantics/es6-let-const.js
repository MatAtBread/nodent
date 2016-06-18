async function inc(m) {
    return m+1 ;
}

async function test1(){
    "use sloppy";
    const p = await inc(0) ;
    var q = p ;
    if (true) {
        var block_var = 0 ;
        const block_const = 0 ;
        let block_let = 0 ;
    }
    function y() {
        var y_var = 0 ;
        const y_const = 0 ;
        let y_let = 0 ;
        return p ;
    }
    return (y() === q);
}

async function test2(){
    "use strict";
    const p = await inc(0) ;
    var q = p ;
    if (true) {
        var block_var = 0 ;
        const block_const = 0 ;
        let block_let = 0 ;
    }
    function y() {
        var y_var = 0 ;
        const y_const = 0 ;
        let y_let = 0 ;
        return p ;
    }
    return (y() === q);
}

module.exports = async function() {
    return await test1() && await test2() ;
}
