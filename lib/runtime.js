var $asyncbind = new Function("self","catcher",
("   var resolver = this;                                                                              "+
"   if (catcher===true) {                                                                             "+
"       if (!Function.prototype.$asyncbind.EagerThenable)                                             "+
"           Function.prototype.$asyncbind.EagerThenable = "+require('./eager.js').toString()+"();     "+
"       return new (Function.prototype.$asyncbind.EagerThenable)(boundThen);                          "+
"   }                                                                                                 "+
"   if (catcher) {                                                                                    "+
"       if (Function.prototype.$asyncbind.wrapAsyncStack)                                             "+
"           catcher = Function.prototype.$asyncbind.wrapAsyncStack(catcher);                          "+
"       return then;                                                                                  "+
"   }                                                                                                 "+
"   function then(result,error){                                                                      "+
"       try {                                                                                         "+
"           return result && (result instanceof Object) && typeof result.then==='function'            "+
"               ? result.then(then,catcher) : resolver.call(self,result,error||catcher);              "+
"       } catch (ex) {                                                                                "+
"           return (error||catcher)(ex);                                                              "+
"       }                                                                                             "+
"   }                                                                                                 "+
"   function boundThen(result,error) {                                                                "+
"       return resolver.call(self,result,error);                                                      "+
"   }                                                                                                 "+
"   boundThen.then = boundThen;                                                                       "+
"   return boundThen;                                                                                 ")
.replace(/\s+/g,' ')) ;

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
