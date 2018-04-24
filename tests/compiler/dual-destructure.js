async function nop(x) { return x }

// work
async function trivialArray() {
  const [a, b] = await nop([1, 2]);
  return [a,b].toString()
}

async function trivialObject() {
  const { a, b } = await nop({ a: 1, b: 2 });
  return [a,b].toString()
}

async function arraySpread() {
  const [a, ...b] = await nop([1, 2, 3, 4]);
  return [a,b].toString()
}

// fails in transform
async function arrayElide() {
  const [,a,,b] = await nop([1, 2, 3, 4]);
  return [a,b].toString()
}

// generate bad code, only declaring `var a, b`
async function rename() {
  const { a, b: c } = await nop({ a: 1, b: 2 });
  return [a,c].toString()
}
async function key() {
  const { a, ['b']: c } = await nop({ a: 1, b: 2 });
  return [a,c].toString()
}
async function nestedArray() {
  const { a, b: [c, d] } = await nop({ a: 1, b: [2, 3] });
  return [a,c,d].toString()
}
async function nestedObject() {
  const { a, b: { c, d } } = await nop({ a: 1, b: { c: 2, d: 3 } });
  return [a,c,d].toString()
}
async function indirect() {
  const result = await nop({ a: 1, b: 2 });
  const { a, b: c } = result;
  return [a,c].toString()
}

// Destructuring with assignment
async function assignObj() {
    await nop();
    const {x = 456} = {x:123};
    return x.toString() ;
}
async function assignArray() {
    await nop();
    const {x = 456} = [789];
    return x.toString() ;
}

return [
  await trivialArray(),await trivialObject(),await rename(),await key(),
  await nestedArray(),await nestedObject(),await indirect(), await arrayElide(),
  await arraySpread(), await assignObj(), await assignArray()
].toString() ;
