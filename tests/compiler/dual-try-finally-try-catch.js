'use nodent';

async function normalFn() {
    return;
}

async function throwingFn() {
    await normalFn();
    JSON.parse("*");
}

async function test() {
    try {
        await normalFn();
    } finally {
        try {
            await throwingFn();
        } catch (err) {
            return err.toString() ;
        }
    }
}

return await test();
