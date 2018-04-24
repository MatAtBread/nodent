var finals = 0 ;
async function inc(i) {
    return i+1
}

async function test() {
    let responses;
    try {
        var l = async function(x) { return await inc(x) }
        var n = async x => await inc(x) ;
        async function m(x) { return await inc(x) }
        return await l(1)+await m(2)+await n(3) ;
    } catch (err) {
        return;
    } finally {
        finals += 1 ;
    }
}

return await test() === 9 && finals === 1
