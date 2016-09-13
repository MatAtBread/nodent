//var catcher ;

module.exports = function() {
    function isThenable(obj) {
        return obj && (obj instanceof Object) && typeof obj.then==="function";
    }

    function Thenable(resolver) {
        var chain ;
        return {
            toString:function(){
                return "Thenable:"+chain;
            },
            resolve:function(){},
            reject:function(){},
            then:function then(resolve,reject){
                // Thenables support a _single_ chained "promise", as required by mapLoops
                chain = new Thenable() ;
                chain.then = function(resole,reject){
                  console.log("CHAINED") ;
                  debugger ;  
                };
                try {
                    resolver(function(result) {
                        return isThenable(result) ? result.then(resolve,reject/*||catcher*/) : (resolve(result), chain && chain.resolve(result));
                    },function(reason) { 
                        reject(reason) ;
                        chain && chain.reject(reason) ;
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
