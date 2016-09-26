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

    function _unchained(v){}
    
    function thenChain(res,rej){
        this.resolve = res;
        this.reject = rej;
    }
    
    function then(res,rej){
        var chain = {
            resolve: _unchained,
            reject: _unchained,
            then: thenChain
        } ;
        try {
            this._resolver(function(value) {
                return isThenable(value) ? value.then(res,rej) : resolution(chain,value,res);
            },function(reason) {
                resolution(chain,reason,rej) ;
            }) ;
        } catch (ex) {
            resolution(chain,ex,rej);
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
