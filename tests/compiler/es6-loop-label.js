async function nop(x) { return x }

var four = [0,1,2,3] ;
async function w(done) {
    var res = [] ;
    var i,j ;
    outer: for (i of four) {
        inner: for (j in four) {
            await nop() ;
            res.push(i,j);
            if (i<=j)
                break inner ;
        }
    }
    return res.join("") ;
}

async function x(done) {
    var res = [] ;
    var i,j ;
    outer: for (i of four) {
        inner: for (j in four) {
            await nop() ;
            res.push(i,j);
            if (i<=j)
                continue outer ;
        }
    }
    return res.join("") ;
}

async function y(done) {
    var res = [] ;
    outer: for (const i of four) {
        inner: for (let j in four) {
            await nop() ;
            res.push(i,j);
            if (i<=j)
                break inner ;
        }
    }
    return res.join("") ;
}

async function z(done) {
    var res = [] ;
    outer: for (let i of four) {
        inner: for (const j in four) {
            await nop() ;
            res.push(i,j);
            if (i<=j)
                continue outer ;
        }
    }
    return res.join("") ;
}

module.exports = async function() {
    return await z() === "00101120212230313233" 
        && await y() === "00101120212230313233"
        && await x() === "00101120212230313233"
        && await w() === "00101120212230313233";
};
