var res ;
async function getSlowRemote() {
	// Do the async return after 60 seconds
	var timer = setTimeout($return,1000) ;
	// Return a synchronous value too:
	return void function() {
		res = ("aborted") ;
		clearTimeout(timer) ;
	}
}  

var abort = getSlowRemote().then(function(){
	res = ("done") ;
}) ; 

if (Promise) {
	module.exports = async function() {
		return "n/a" ;
	}
} else {
	module.exports = async function() {
		function done(){
			res = "done" ;
		}
		var abort = getSlowRemote()(done) ;
		abort() ;
		var a = res ;
		await getSlowRemote() ;
		var b = res ;
		return a+b == "aborteddone" ;
	}
}

