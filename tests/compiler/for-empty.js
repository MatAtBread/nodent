async function emptyFor(){
    for (;;) {
        await g();
    }
}

module.exports = async function(){
    return true ;
}
