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
        for (var i=0; i<_tasks.length; i+=2) {
            var t = _tasks[i+1], r = _tasks[i] ;
            for (var j=0; j<t.length; j++)
                t[j].call(null,r) ;
        }
        _tasks = [] ;
    }

    function isThenable(obj) {
        return obj && (obj instanceof Object) && typeof obj.then==="function";
    }

    function EagerThenable(resolver) {
        function done(inline){
            var w ;
            if (_sync || phase<0 || (w = _thens[phase]).length===0)
                return ;

            _tasks.push(result,w) ;
            _thens = [[],[]] ;
            if (_tasks.length===2)
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
            done() ;
        }
        function toString() {
            return "EagerThenable{"+{'-1':"pending",0:"resolved",1:"rejected"}[phase]+"}="+result.toString() ;
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

        var _thens = [[],[]], _sync = true, phase = -1, result ;
        guard() ;
        _sync = false ;
        done() ;
    }

    EagerThenable.resolve = function(v){
        return isThenable(v) ? v : {then:function(resolve,reject){return resolve(v)}};
    };

    return EagerThenable ;
}

module.exports = factory ;
