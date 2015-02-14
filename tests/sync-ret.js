"use nodent-es7" ;

console.log(arguments.callee.toString()) ;

async function getSlowRemote() {
	// Do the async return after 60 seconds
	var timer = setTimeout($return,1000) ;
	// Return a synchronous value too:
	return void function() {
		console.log("aborted") ;
		clearTimeout(timer) ;
	}
}  

var abort = getSlowRemote()(function(){
	console.log("done") ;
}) ; 

abort() ;
