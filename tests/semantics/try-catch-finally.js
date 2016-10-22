function sync(r,a) {
    try {
        r.push("try") ;
        if (a&1) throw ["a"].concat(r) ;
        if (a&4) return ["b"].concat(r) ;
        if (a&16) JSON.parse('*') ;
    } catch (ex) {
        r.push("catch("+ex+")") ;
        if (a&2) throw ["c"].concat(r) ;
        if (a&8) return ["d"].concat(r) ;
        if (a&32) JSON.parse('*') ;
    } finally {
    	r.push("finally") ;
        if (a&64) throw ["c"].concat(r) ;
        if (a&128) return ["d"].concat(r) ;
        if (a&256) JSON.parse('*') ;
    }
    r.push("done") ;
    return ["r"].concat(r) ;
}

async function async(r,a,f) {
    try {
    	await f() ;
        r.push("try") ;
        if (a&1) throw ["a"].concat(r) ;
        if (a&4) return ["b"].concat(r) ;
        if (a&16) JSON.parse('*') ;
    } catch (ex) {
        r.push("catch("+ex+")") ;
        if (a&2) throw ["c"].concat(r) ;
        if (a&8) return ["d"].concat(r) ;
        if (a&32) JSON.parse('*') ;
    } finally {
    	r.push("finally") ;
        if (a&64) throw ["c"].concat(r) ;
        if (a&128) return ["d"].concat(r) ;
        if (a&256) JSON.parse('*') ;
    }
    r.push("done") ;
    return ["r"].concat(r) ;
}

async function check() {
	var f = true,r,a,b,c,i,z = 512;
	for (i=0; i<z; i++) {
		r = [];
		try {
			a = "r:"+sync(r,i) +"|"+r ;
		} catch(ex) {
			a = "x:"+ex +"|"+r ;
		}

		r = [];
		try {
			b = "r:"+await async(r,i,async function() { return })+"|"+r ;
		} catch(ex) {
			b = "x:"+ex +"|"+r ;
		}

		r = [];
		try {
			c = "r:"+await async(r,i,async function() { setImmediate(function(){ async return }) }) +"|"+r ;
		} catch(ex) {
			c = "x:"+ex+"|"+r ;
		}

		if (a != b) {
			f = false ;
			//console.log('s',i,a == b?"pass":"FAIL",("0000000"+(i.toString(2))).substr(-8),a,b) ;
		}
		if (a != c) {
			f = false ;
			//console.log('s',i,a == c?"pass":"FAIL",("0000000"+(i.toString(2))).substr(-8),a,c) ;
		}
	}
	return f && i==z ;
}

module.exports = check ;
//check().then(console.log.bind(console,"return"),console.log.bind(console,"exception"))