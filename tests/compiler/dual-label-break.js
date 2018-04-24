var l = "";
async function nop(a) { return a ; }
async function x(f) {
    l += ".";
    a:{
        l += "1";
        b:{
            l += "2";
            switch (await nop(f)) {
                case 'a':
                    break a;
                case 'b':
                    break b;
            }
            l += "3";
        }
        l += "4";
    }
    l += "5";
}

await x();
await x('a');
await x('b');
return l;
