'use nodent';

async function foo() {
    JSON.parse("*");
}

async function bar() { }

async function baz() {
    do await bar();
    while(false);
    await foo() ;
}

try {
    await baz() ;
    return "baz" ;
} catch (ex) {
    return ex.message ;
}
