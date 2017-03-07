async function a() {
    var x = async () => ({arguments:[789]});
    return ((await x()).arguments[0]===789);
}

async function b() {
    var x = () => ({arguments:[789]});
    return (x().arguments[0]===789);
}

async function c() {
    var x = async () => ({arguments});
    return ((await x()).arguments[0]===56);
}

async function d() {
    var x = () => ({arguments});
    return (x().arguments[0]===78);
}

return [await a(12), await b(34), await c(56), await d(78)].toString();