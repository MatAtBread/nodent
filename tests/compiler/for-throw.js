async function inc(x) {
    return x + 1;
}

async function test() {
    var n = 0;
    try {
        for (var i = 0;i < 10; i = await inc(i)) {
            if (i == 2) 
                continue;
            n += 1;
            if (i == 4) 
                i = await inc(i);
            try {
                if (i == 6) 
                    i = await inc(JSON.parse("*"));
            } catch (ex) {
                i = await inc(99);
                throw ex;
            }
        }
    } catch (ex) {
        return i == 100 && n == 5;
    }
}

module.exports = test ;
