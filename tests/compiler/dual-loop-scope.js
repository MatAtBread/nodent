

async function nop(x) { return x }
var x = {
    ab:"ab",
    cd:"cd",
    ef:"ef",
    gh:"gh",

    async loopScope() {
        var x = -1;
        var s = "";
        for (let x = 0;x < 2; x++) {
            s += await nop(this.ab[x]);
        }
        for (let x = 0;x < 2; x++) {
            s += await nop(this.cd[x]);
            for (let x = 0;x < 2; x++) {
                s += await nop(this.ef[x]);
            }
            s += await nop(this.gh[x]);
        }
        return x === -1 && s === "abcefgdefh";
    }
};

return await x.loopScope();
