var r = [] ;

async function op(x) {
    if (x==='reject') throw x ;
    return y ;
}

async function a(x,y) {
    try {
        await op(x);
        r.push('DONE '+y);
    } catch (error) {
        r.push('EXCEPTION '+y);
    }
    finally {
        r.push("Finally "+x) ;
    }
    JSON.parse(y+'#');
}

try {
    await a('resolve','A');
} catch (ex) {
    r.push(ex) ;
}
try {
    await a('reject','A');
} catch (ex) {
    r.push(ex) ;
}

return (r.toString())
