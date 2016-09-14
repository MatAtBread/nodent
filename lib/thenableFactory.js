module.exports = function() {
    function isThenable(obj) {
        return obj && (obj instanceof Object) && typeof obj.then==="function";
    }

    function Thenable(resolver) {
        var chain ;
        return {
            toString:function(){
                return "Thenable";
            },
            resolve:function(){},
            reject:function(){},
            then:function then(resolve,reject){
                // Thenables support a _single_ chained "promise", as required by mapLoops
                chain = new Thenable() ;
                chain.then = function(resolve,reject){
                    console.log("CHAINED") ;
                    debugger ;  
                    if ('result' in this)
                        return resolve(this.result) ;
                    if ('reason' in this)
                        return reject(this.result) ;
                    chain.resolve = resolve ;
                    chain.reject = reject ;
                };
                try {
                    resolver(function(result) {
                        return isThenable(result) ? result.then(resolve,reject) : (resolve(chain.result = result), chain.resolve(result));
                    },function(reason) { 
                        reject(chain.reason = reason) ;
                        chain.reject(reason) ;
                    }) ;
                } catch (ex) {
                    reject(ex);
                }
                return chain ;
            }
        } ;
    };

    Thenable.resolve = function(v){
        return Thenable.isThenable(v) ? v : {then:function(resolve){return resolve(v)}};
    };

    Thenable.isThenable = function(obj) {
        return obj && (obj instanceof Object) && typeof obj.then==="function";
    }

    return Thenable ;
} ;
