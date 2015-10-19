"use nodent-es7";
async function x() { 
	setImmediate(function(){ async return }) ;
} ;

function sync(r,a) {
    try {
        r.push("try") ;
        if (a&1) throw ["a"].concat(r) ;
        if (a&2) return ["b"].concat(r) ;
        if (a&64) JSON.parse('*') ;
    } catch (ex) {
        r.push("catch("+ex+")") ;
        if (a&4) throw ["c"].concat(r) ;
        if (a&8) return ["d"].concat(r) ;
        if (a&128) JSON.parse('*') ;
    } finally {
        r.push("finally") ;
        if (a&16) throw ["e"].concat(r) ;
        if (a&32) return ["f"].concat(r) ;
        if (a&256) JSON.parse('*') ;
    }
    r.push("done") ;
    return ["r"].concat(r) ;
}

async function async(r,a) {
    try {
        await x();
        r.push("try") ;
        if (a&1) throw ["a"].concat(r) ;
        if (a&2) return ["b"].concat(r) ;
        if (a&64) JSON.parse('*') ;
    } catch (ex) {
        r.push("catch("+ex+")") ;
        if (a&4) throw ["c"].concat(r) ;
        if (a&8) return ["d"].concat(r) ;
        if (a&128) JSON.parse('*') ;
    } finally {
        r.push("finally") ;
        if (a&16) throw ["e"].concat(r) ;
        if (a&32) return ["f"].concat(r) ;
        if (a&256) JSON.parse('*') ;
    }
    r.push("done") ;
    return ["r"].concat(r) ;
}

module.exports = check ;

async function check() {
	var f = true, r,a,results = [] ;
	for (var i=0; i<64; i++) {
		r = [];
		try {
			results[i] = "r:"+sync(r,i)+"|"+r ;
		} catch(ex) {
			results[i] = "x:"+ex+"|"+r ;
		}
	}

	for (var i=0; i<64; i++) {
		r = [];
		try {
			a = "r:"+await async(r,i)+"|"+r ;
		} catch(ex) {
			a = "x:"+ex+"|"+r ;
		}
		if (a != results[i]) {
			f = false ;
			console.log(i,a == results[i]?"pass":"FAIL",("00000"+(i.toString(2))).substr(-6),a,results[i]) ;
		}
	}
	return f ;
}
await check() ;