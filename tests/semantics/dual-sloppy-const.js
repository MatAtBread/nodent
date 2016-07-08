async function nop(x) { return x }

{
    {
        const a = 1;
    }
    const b = 2;
    return (await nop([a,b])).join(",") ;
}
