var res ;
async function getSlowRemote() {
	// Do the async return after 1 seconds
	var timer = setTimeout(function(){ async return 0 },100) ;
	// Return a synchronous value too:
	return void function() {
		res = "aborted" ;
		clearTimeout(timer) ;
	}
}  
if (!es7) {
	module.exports = async function() {
		return "n/a" ;
	}
} else {
	module.exports = async function() {
		res = "" ;
		function done(){
			res = "done" ;
		}
		var abort = getSlowRemote()(done) ;
		abort() ;
		var a = res ;
		await getSlowRemote() ;
		done() ;
		var b = res ;
		return a+b=="aborteddone" ;
	}
}
