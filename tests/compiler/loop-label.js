var map = nodent.require('map') ;
async function nop(x) { return x }

var four = [0,1,2,3] ;
async function w(done) {
    var res = [] ;
    var i,j ;
    outer: for (i in four) {
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
    outer: for (i in four) {
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
    var i,j ;
    outer: for (i=0; i<4; i++) {
        inner: for (j=0; j<4; j++) {
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
    var i,j ;
    outer: for (i=0; i<4; i++) {
        for (j=0; j<4; j++) {
            await nop() ;
            res.push(i,j);
            if (i<=j)
                continue outer ;
        }
    }
    return res.join("") ;
}

module.exports = async function() {
    var a = await map([w(),x(),y(),z()]) ;
    return a[0] === "00101120212230313233" 
        && a[1] === "00101120212230313233"
        && a[2] === "00101120212230313233"
        && a[3] === "00101120212230313233";
};