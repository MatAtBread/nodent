module.exports = function() {
    function isThenable(obj) {
        return obj && (obj instanceof Object) && typeof obj.then==="function";
    }

    function resolution(p,r,how) {
        try {
            // 2.2.7.1
            var x = how ? how(r):r ;
            
            if (p===x) // 2.3.1
                return p.reject(new TypeError("Promise resolution loop")) ;

            if (isThenable(x)) {
                // 2.3.3
                x.then(function(y){
                    resolution(p,y);
                },function(e){
                    p.reject(e)
                }) ;
            } else {
                p.resolve(x) ;
            }
        } catch (ex) {
            // 2.2.7.2
            p.reject(ex) ;
        }
    }

    function resolveChain(v){
        this._state = 0 ;
        this._value = v ;
    }
    function rejectChain(e){
        this._state = 1 ;
        this._value = e ;
    }
    function thenChain(res,rej){
        if ('_state' in this) 
            arguments[this._state](this._value) ;
        else {
            this.resolve = res; 
            this.reject = rej;
        }/*
        var chain = new Thenable() ;
        chain.resolve = resolveChain ;
        chain.reject = rejectChain ;
        chain.then = thenChain ;
        return chain ;*/
    }
    function then(resolve,reject){
        var chain = new Thenable() ;
        chain.resolve = resolveChain ;
        chain.reject = rejectChain ;
        chain.then = thenChain ;
        try {
            this._resolver(function(result) {
                return isThenable(result) ? result.then(resolve,reject) : resolution(chain,result,resolve);
            },function(reason) { 
                resolution(chain,reason,reject) ;
            }) ;
        } catch (ex) {
            resolution(chain,reject(ex));
        }
        return chain ;
    }
    
    function Thenable(resolver) {
        this._resolver = resolver ;
        this.then = then ;
    };

    Thenable.resolve = function(v){
        return Thenable.isThenable(v) ? v : {then:function(resolve){return resolve(v)}};
    };

    Thenable.isThenable = isThenable ;

    return Thenable ;
} ;
