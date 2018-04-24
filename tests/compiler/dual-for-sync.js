async function nop() {}

async function x() {
    var s = "" ;
    i:for (var i = 0;i < 3; i++) {
        j:for (var j = 0;j < 3; j++) {
            await nop();
            k:for (var k = 0;k < 3; k++) {
                s += [i, j, k].toString()+"_";
                if (k == 2) 
                    continue i;
            }
        }
    }
    return s ;
}

var s = "" ;
i:for (var i = 0;i < 3; i++) {
    j:for (var j = 0;j < 3; j++) {
        await nop();
        k:for (var k = 0;k < 3; k++) {
            s += [i, j, k].toString()+"_";
            if (k == 2) 
                continue i;
        }
    }
}
return s+await x() ;
