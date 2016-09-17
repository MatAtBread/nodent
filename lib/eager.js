/* A 'Thenable' Implementation that eagerly evaluates and resolves in the next tick, so as to mimic the behaviour of (unchainable) Promises.
 *
 * It's also designed to be so small it can comfortably be contained in a single function ('factory') so it can be serialised and shipped around.
 */
function factory(tick){
    var _tasks = [] ;

    if (!tick) {
        try {
            tick = process.nextTick ;
        } catch (ex) {
            try {
                tick = setImmediate ;
            } catch (ex) {
                tick = function(p) { setTimeout(p,0) }
            }
        }
    }

    function _untask(){
        var i = 0 ;
        while (i<_tasks.length) {
            var t = _tasks[i+1], r = _tasks[i], ch = _tasks[i+2] ;
            _tasks[i++] = _tasks[i++] = _tasks[i++] = null ; // release refs to allow for GC
            if (i>=_tasks.length) {
                _tasks = [] ;
                i = 0 ;
            }
            for (var j=0; j<t.length; j++)
                resolution(ch[j],r,t[j]) ;
        }
    }

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

    function EagerThenable(resolver) {
        function done(inline){
            var w ;
            if (_sync || phase<0 || _thens[0].length===0)
                return ;

            var start = !_tasks.length ;
            _tasks.push(result,_thens[phase],_thens[2]) ;
            _thens = [[],[],[]] ;
            if (start)
                inline?_untask():tick(_untask) ;
        }
        function resolveThen(x){
            if (phase>=0) return ;
            if (isThenable(x))
                return x.then(resolveThen,rejectThen) ;
            phase = 0 ;
            result = x ;
            done(true) ;
        }
        function rejectThen(x){
            if (phase>=0) return ;
            if (isThenable(x))
                return x.then(resolveThen,rejectThen) ;
            phase = 1 ;
            result = x ;
            done(true) ;
        }
        function settler(resolver,rejecter){
            _thens[0].push(resolver) ;
            _thens[1].push(rejecter) ;
            var chain = new EagerThenable() ;
            _thens[2].push(chain) ;
            done() ;
            return chain ;
        }
        function toString() {
            return "EagerThenable{"+{'-1':"pending",0:"resolved",1:"rejected"}[phase]+"}="+result ;
        }
        function guard() {
          try {
            resolver(resolveThen,rejectThen) ;
          } catch (ex) {
            rejectThen(ex) ;
          }
        }

        this.then = settler ;
        this.toString = toString ;

        var _thens = [[],[],[]], _sync, phase = -1, result ;
        
        if (resolver) {
            _sync = true ;
            guard() ;
            _sync = false ;
            done(/*true*/) ;
        } else {
            // Chained
            _sync = false ;
            this.resolve = resolveThen ;
            this.reject = rejectThen ;
        }
    }

    EagerThenable.resolve = function(v){
        return isThenable(v) ? v : {then:function(resolve,reject){return resolve(v)}};
    };

    return EagerThenable ;
}

module.exports = factory ;
