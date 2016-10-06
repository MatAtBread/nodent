Object.defineProperty(Array.prototype,'pushAsync',{
    writable:true,
    configurable:true,
    value:async function() {
	    [].push.apply(this,arguments) ;
	}
}) ;

async function log() {
    console.log.apply(console,arguments) ;
}

async function iterate(object) {
    var j,b=[],c=[] ;

    for (var i in object) b.push(i);
    b.push(i);
    for (var i in object) await c.pushAsync(i);
    await c.pushAsync(i);

    for (var n=0; n<b.length; n++)
        if (b[n]!=c[n]) return false ;
    if (b.length != c.length) return false ;

    b = [];
    c = [];
    for (j in object) b.push(j);
    b.push(j);
    for (j in object) await c.pushAsync(j);
    await c.pushAsync(j);

    for (var n=0; n<b.length; n++)
        if (b[n]!=c[n]) return false ;
    if (b.length != c.length) return false ;
    
    return true;
}

module.exports = async function(){
    var o = Object.create({
        abc:123,
        def:456
    }) ;
    o.def = 789 ;
    o.ghi = 101 ;
    return await iterate([4,3,undefined,2,1])
        && await iterate(o)  ;
}
