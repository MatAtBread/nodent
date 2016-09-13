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
    return new Function(args,t)() ;
}

var $asyncbind = processIncludes({
    eager:require('./eager').toString(),
    thenable:require('./thenableFactory').toString()
},
function $asyncbind(self,catcher) {
    if (!Function.prototype.$asyncbind)
        Function.prototype.$asyncbind = $asyncbind ;
    
    if (!Function.prototype.$asyncbind.Thenable) {
        Function.prototype.$asyncbind.Thenable = !!!'thenable'();
    }
    if (!Function.prototype.$asyncbind.EagerThenable)
        Function.prototype.$asyncbind.EagerThenable = !!!'eager'();

    var resolver = this;
    if (catcher===true) {
        return new (Function.prototype.$asyncbind.EagerThenable)(boundThen);
    }
    if (catcher) {
        if (Function.prototype.$asyncbind.wrapAsyncStack)
            catcher = Function.prototype.$asyncbind.wrapAsyncStack(catcher);
        return boundThen ;
    } else if (catcher===0) {
        return (Function.prototype.$asyncbind.Thenable)(boundThen);
    }
    function boundThen() {
        return resolver.apply(self,arguments);
    }
    return boundThen ;
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

module.exports = {
    $asyncbind:$asyncbind,
    $asyncspawn:$asyncspawn
};
