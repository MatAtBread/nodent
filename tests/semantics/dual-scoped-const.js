try {
    async function nop(x) { return x }

    var r = [] ;

    const a = 1 ;
    {
        const a = 2 ;
        var b = await nop(a) ;
        {
            const a = await nop(3) ;
            {
                const a = 4 ;
                b = a ;
                r.push(a,b) ;
            }
            b = a ;
            r.push(a,b) ;
        }
        r.push(a,b) ;
    }
    r.push(a,await nop(b)) ;
    return r.join(",") ;
} catch (ex) {
    return ex.message ;
}