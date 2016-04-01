function Thenable(thenable) {
    return thenable.then = thenable ;
};

Thenable.resolve = function(v){
    return Thenable.isThenable(v) ? v : {then:function(resolve){return resolve(v)}};
};

Thenable.isThenable = function(obj) {
    return obj && (obj instanceof Object) && typeof obj.then==="function";
}

module.exports = Thenable ;
