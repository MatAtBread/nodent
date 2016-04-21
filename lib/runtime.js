var $asyncbind = eval(("(function $asyncbind(self,catcher){                                           \n"+
"   var resolver = this;                                                                              \n"+
"   if (catcher===true) {                                                                             \n"+
"       if (!Function.prototype.$asyncbind.EagerThenable)                                             \n"+
"           Function.prototype.$asyncbind.EagerThenable = "+require('./eager.js').toString()+"(); \n"+
"       return new (Function.prototype.$asyncbind.EagerThenable)(boundThen);                          \n"+
"   }                                                                                                 \n"+
"   if (catcher) {                                                                                    \n"+
"       if (Function.prototype.$asyncbind.wrapAsyncStack)                                             \n"+
"           catcher = Function.prototype.$asyncbind.wrapAsyncStack(catcher);                          \n"+
"       return then;                                                                                  \n"+
"   }                                                                                                 \n"+
"   function then(result,error){                                                                      \n"+
"       try {                                                                                         \n"+
"           return result && (result instanceof Object) && typeof result.then==='function'            \n"+
"               ? result.then(then,catcher) : resolver.call(self,result,error||catcher);              \n"+
"       } catch (ex) {                                                                                \n"+
"           return (error||catcher)(ex);                                                              \n"+
"       }                                                                                             \n"+
"   }                                                                                                 \n"+
"   function boundThen(result,error) {                                                                \n"+
"       return resolver.call(self,result,error);                                                      \n"+
"   }                                                                                                 \n"+
"   boundThen.then = boundThen;                                                                       \n"+
"   return boundThen;                                                                                 \n"+
"})").replace(/\s+/g,' ')) ;

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
