async function inc(m) {
    return m+1 ;
}

module.exports = async function(){
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
