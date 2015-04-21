async function doStuff(x) {
    setTimeout(function() {
        throw async new Error(x);
    }, 10);
};

module.exports = async function() {
	var s = "" ;
    try {
        await doStuff("abc");
    } catch (e) {
    	s = s+e.message ;
    }
    try {
        await doStuff("def");
    } catch (e) {
    	s = s+e.message ;
    }
    return s=="abcdef" ;
};
