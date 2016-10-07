"use strict";
/*
 * $asyncbind has multiple uses, depending on the parameter list. It is in Function.prototype, so 'this' is always a function
 *
 * 1) If called with a single argument (this), it is used when defining an async function to ensure when
 *      it is invoked, the correct 'this' is present, just like "bind"
 * 2) If called with a second parameter ("catcher") and catcher!==true it is being used to invoke an async
 *      function where the second parameter is the error callback (for sync exceptions and to be passed to
 *      nested async calls)
 * 3) If called with the second parameter===true, it is the same use as (1), but the function is wrapped
 *      in an 'EagerThenable' as well bound to 'this'.
 *      It is the same as calling new EagerThenable(this), where 'this' is the function being bound/wrapped
 * 4) If called with the second parameter===0, it is the same use as (1), but the function is wrapped
 *      in a 'Thenable', which executes lazily and can resolve synchronously.
 *      It is the same as calling new Thenable(fn), where 'this' is the function being bound/wrapped
 */

function processIncludes(includes,input) {
    var src = input.toString() ;
    var t = "return "+src ;
    var args = src.match(/.*\(([^)]*)\)/)[1] ;
    var re = /!!!'([^']*)'/g ;
    var m = [] ;
    while (1) {
        var mx = re.exec(t) ;
        if (mx)
            m.push(mx) ;
        else break ;
    }
    m.reverse().forEach(function(e){
        t = t.slice(0,e.index)+includes[e[1]]+t.substr(e.index+e[0].length) ;
    }) ;
    t = t.replace(/\/\*[^*]*\*\//g,' ').replace(/\s+/g,' ') ;
    return new Function(args,t)() ;
}

var $asyncbind = processIncludes({
    zousan:require('./zousan').toString(),
    thenable:require('./thenableFactory').toString()
},
function $asyncbind(self,catcher) {
    "use strict";
    if (!Function.prototype.$asyncbind)
        Function.prototype.$asyncbind = $asyncbind ;

    if (!$asyncbind.trampoline) {
      $asyncbind.trampoline = function trampoline(t,x,s,e){
        return function b(q) {
                while (q) {
                    if (q.then)
                        return q.then(b, e);
                    try {
                        if (q.pop) {
                            if (q.length)
                              return q.pop() ? x.call(t) : q;
                            q = s;
                         } else
                            q = q.call(t)
                    } catch (r) {
                        return e(r);
                    }
                }
            }
        };
    }
    if (!$asyncbind.LazyThenable) {
        $asyncbind.LazyThenable = !!!'thenable'();
        $asyncbind.EagerThenable = $asyncbind.Thenable = ($asyncbind.EagerThenableFactory = !!!'zousan')();
    }

    var resolver = this;
    switch (catcher) {
    case true:
        return new ($asyncbind.Thenable)(boundThen);
    case 0:
        return new ($asyncbind.LazyThenable)(boundThen);
    case undefined:
        /* For runtime compatibility with Nodent v2.x, provide a thenable */
        boundThen.then = boundThen ;
        return boundThen ;
    default:
        return function(){
            try {
                return resolver.apply(self,arguments);
            } catch(ex) {
                return catcher(ex);
            }
        }
    }
    function boundThen() {
        return resolver.apply(self,arguments);
    }
}) ;

function $asyncspawn(promiseProvider,self) {
    var genF = this ;
    return new promiseProvider(function enough(resolve, reject) {
        var gen = genF.call(self, resolve, reject);
        function step(fn,arg) {
            var next;
            try {
                next = fn.call(gen,arg);
                if(next.done) {
                    if (next.value !== resolve) {
                        if (next.value && next.value===next.value.then)
                            return next.value(resolve,reject) ;
                        resolve && resolve(next.value);
                        resolve = null ;
                    }
                    return;
                }

                if (next.value.then) {
                    next.value.then(function(v) {
                        step(gen.next,v);
                    }, function(e) {
                        step(gen.throw,e);
                    });
                } else {
                    step(gen.next,next.value);
                }
            } catch(e) {
                reject && reject(e);
                reject = null ;
                return;
            }
        }
        step(gen.next);
    });
}

$asyncbind() ;
module.exports = {
    $asyncbind:$asyncbind,
    $asyncspawn:$asyncspawn
};
