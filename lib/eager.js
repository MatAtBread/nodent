/* A 'Thenable' Implementation that eagerly evaluates, so as to mimic the behaviour of (unchainable) Promises */
var _tasks = [] ;
var tick = process.nextTick ;

function _untask(){
	for (var i=0; i<_tasks.length; i+=2) {
    var t = _tasks[i+1], r = _tasks[i] ;
    for (var j=0; j<t.length; j++)
      t[j].call(null,r) ;
  }
	_tasks = [] ;
}

function EagerThenable(resolver) {
		function done(){
      var w ;
      if (_sync || phase<0 || (w = _thens[phase]).length===0)
        return ;

      _tasks.push(result,w) ;
			_thens = [[],[]] ;
			if (_tasks.length===2)
				tick(_untask) ;
		}
    function resolveThen(x){
        if (isThenable(x))
	        return x.then(resolveThen,rejectThen) ;
        phase = 0 ;
        result = x ;
				done() ;
    }
    function rejectThen(x){
        if (isThenable(x))
            return x.then(resolveThen,rejectThen) ;
        phase = 1 ;
        result = x ;
				done() ;
    }
    function settler(resolver,rejecter){
        _thens[0].push(resolver) ;
        _thens[1].push(rejecter) ;
        done() ;
    }

		this.then = settler ;

		var _thens = [[],[]], _sync = true, phase = -1, result ;
    resolver.call(null,resolveThen,rejectThen) ;
		_sync = false ;
		done() ;
}

EagerThenable.resolve = function(v){
    return isThenable(v) ? v : {then:function(resolve,reject){return resolve(v)}};
};

module.exports = EagerThenable ;
