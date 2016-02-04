function Nothing(){}

module.exports = function(nodent,config) {
    config = config || {} ;
    if (!('promises' in config))
        config.promises = 'Promise' in global ;
    if (!('log' in config) || config.log===false)
        config.log = Nothing ;
            
    function AsyncFunction() {
        var params = [].slice.call(arguments,0,-1) ;
        var source = "async function anonymous_AsyncFunction("+params.join(",")+") {\n"+arguments[arguments.length-1]+"\n}" ;
        var pr = nodent.compile(source,"(new AsyncFunction)",undefined,config) ;
        pr.ast = pr.ast.body[0].body ;
        var asyncBody = nodent.prettyPrint(pr,config).code ;
        params.push(asyncBody.slice(2,-2)) ;
        var fn = Function.apply(this,params) ;
        fn.__proto__ = AsyncFunction.prototype ;
        Object.defineProperty(fn,"source",{value:source}) ;
        fn.constructor = AsyncFunction ;
        return fn ;
    }
    
    AsyncFunction.prototype = Object.create(Function.prototype,{
        toString:{
            value:function(){
                return this.source ;
            }
        },
        toES5String:{
            value:function(){
                return Function.toString.apply(this) ;
            }
        },
    }) ;
    
    return AsyncFunction ;
}
