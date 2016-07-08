async function nop(x) { return x }

{
    const b = 2;
    {
        const a = 1;
        return (await nop([a,b])).join(",") ;
    }
}
