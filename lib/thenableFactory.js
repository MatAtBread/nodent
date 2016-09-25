module.exports = function() {
    function isThenable(obj) {
        return obj && (obj instanceof Object) && typeof obj.then==="function";
    }

    function resolution(p,r,how) {
        try {
            /* 2.2.7.1 */
            var x = how ? how(r):r ;

            if (p===x) /* 2.3.1 */
                return p.reject(new TypeError("Promise resolution loop")) ;

            if (isThenable(x)) {
                /* 2.3.3 */
                x.then(function(y){
                    resolution(p,y);
                },function(e){
                    p.reject(e)
                }) ;
            } else {
                p.resolve(x) ;
            }
        } catch (ex) {
            /* 2.2.7.2 */
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
        var chain = chainLink() ;
        if ('_state' in this) {
            if (this._state==0) {
                isThenable(this._value) ? this._value.then(resolve,reject) : resolution(chain,this._value,res) ;
            } else {
                resolution(chain,this._value,rej) ;
            }
        } else {
            this.resolve = res;
            this.reject = rej;
        }
        return chain ;
    }
    function chainLink() {
        return {
            resolve: resolveChain,
            reject: rejectChain,
            then: thenChain
        }
    }
    function then(res,rej){
        var chain = chainLink() ;
        try {
            this._resolver(function(value) {
                return isThenable(value) ? value.then(res,rej) : resolution(chain,value,res);
            },function(reason) {
                resolution(chain,reason,rej) ;
            }) ;
        } catch (ex) {
            resolution(chain,rej(ex));
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
