'use nodent';
async function nop(x) {
    return x;
}

async function _un(a, b, c) {
    try {
        await nop();
        if (b)
            throw b;
        return c;
    } catch (ex) {
        return ex;
    }
}

async function _if(a, b, c) {
    if (a)
        try {
        await nop();
        if (b)
            throw b;
        return c;
    } catch (ex) {
        return ex;
    }
    return "."
}

async function _label(a, b, c) {
    a:try {
        await nop();
        if (b)
            throw b;
        return c;
    } catch (ex) {
        return ex;
    }
}

var s = "";
for (var i = 0;i < 8; i++) {
    s = s + await _un(i & 1, i & 2, i & 4)+ await _if(i & 1, i & 2, i & 4) + await _label(i & 1, i & 2, i & 4) + ", ";
}
return s ;
