async function x() { }

async function z(done) {
    var res = [] ;
    var i,j ;
    outer: for (i=0; i<4; i++) {
        for (j=0; j<4; j++) {
            await x() ;
            res.push(i,j);
            if (i<=j)
                continue outer ;
        }
    }
    return res.join("") ;
}

module.exports = async function() {
    return await z() === "00101120212230313233" ;
};