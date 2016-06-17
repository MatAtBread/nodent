async function x() { }

async function z(a) {
    for (var i=0; i<3; i++) {
        if (this !== a)
            return -1 ;

        await x() ;
        if (this !== a)
            return -1 ;
    }
    return i ;
}

module.exports = async function() {
    var obj = {} ;
    return await z.call(obj,obj) === 3 ;
};
