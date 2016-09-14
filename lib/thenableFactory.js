module.exports = function() {
    function isThenable(obj) {
        return obj && (obj instanceof Object) && typeof obj.then==="function";
    }

    function process(p,r,how) {
        try {
            // 2.2.7.1
            var x = how ? how(r):r ;
            
            if (p===x) // 2.3.1
                return p.reject(new TypeError("Promise resolution loop")) ;

            if (isThenable(x)) {
                // 2.3.3
                x.then(function(y){
                    process(p,y);
                },p.reject) ;
            } else {
                p.resolve(x) ;
            }
        } catch (ex) {
            // 2.2.7.2
            p.reject(ex) ;
        }
    }

    function Thenable(resolver) {
        var chain ;
        return {
            toString:function(){
                return "Thenable";
            },
            then:function then(resolve,reject){
                chain = new Thenable() ;
                chain.resolve = function(v){
                    chain._state = 0 ;
                    chain._value = v ;
                } ;
                chain.reject = function(e){
                    chain._state = 1 ;
                    chain._value = e ;
                } ;
                chain.then = function(res,rej){
                    if ('_state' in chain) arguments[chain._state](chain._value) ;
                    else {
                        chain.resolve = function(v){ return res(v) }
                        chain.reject = function(e){ return rej(e) }
                    }
                } ;
                try {
                    resolver(function(result) {
                        return isThenable(result) ? result.then(resolve,reject) : process(chain,result,resolve);
                    },function(reason) { 
                        process(chain,reason,reject) ;
                    }) ;
                } catch (ex) {
                    process(chain,reject(ex));
                }
                return chain ;
            }
        } ;
    };

    Thenable.resolve = function(v){
        return Thenable.isThenable(v) ? v : {then:function(resolve){return resolve(v)}};
    };

    Thenable.isThenable = isThenable ;

    return Thenable ;
} ;
