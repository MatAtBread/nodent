'use nodent';

async function nop(x) { return x }
async function x() {
    
    const r = [] ;
    let x1 = await nop(4) ;
    {
        let x2 = await nop(3) ;
        try {
            const x3 = await nop(2) ;
            {
                let x1 = await nop(1) ;
                r.push(x1) ;
            }
            r.push(x3) ;
        } catch (ex) {
            r.push("x") ;
        }
        r.push(x2) ;
    }
    r.push(x1) ;
    return r.join("-") ;
}

return await x() ;
