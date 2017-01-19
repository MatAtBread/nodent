'use nodent';

async function nop(x) { return x }
async function fn1() {
    try {
        throw new Error();
    }
    catch (error) {
        return 'caught';
    }
    finally {
        return 'ok';
    }
}

async function fn2() {
    try {
        return '1';
    }
    finally {
        return '2';
    }
}

async function fn3() {
    try {
        throw '1';
    } catch (ex) {
        return '2';
    }
}

async function fn(a) {
    try {
        if (a&1)
            return '1';
        throw new Error() ;
    }
    catch (ex) {
        if (a&2)
            return '2' ;
        return '4' ;
    }
    finally {
        if (a&4)
            return '3' ;
    }
}

var s = "" ;
for (var i=0; i<8; i++)
    s += await fn(i) ;
return s+await fn1()+":"+await fn2()+":"+await fn3();
