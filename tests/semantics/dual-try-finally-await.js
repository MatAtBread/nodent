'use nodent';

async function func1() { throw new Error('func1 error'); }
async function func2() { return; }

async function test() {
  try {
    await func1();
  } catch (err) {
    throw err;
  } finally {
   await func2();
  }
}

try {
    throw await test();
} catch(ex) {
    return ex.toString() ;
}
