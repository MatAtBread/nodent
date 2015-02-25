"use nodent-es7" ;

//console.log(arguments.callee.toString()) ;

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

var abort = getSlowRemote()(function(){
	res = ("done") ;
}) ; 

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

