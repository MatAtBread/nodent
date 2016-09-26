/* Syntax checks - just make sure it all compiles */
module.exports = async function() {
	return true ;
}

function syntax() { 
	var async, await ;
//	syntax checks
	var r = async(w) => w+1 ;
	r = async(w) => { return async function(async) { return (async(async)=>async+1)(async-1) }} ;


	// An async arrow
	async(b)=>0 ;

	// A call to 'async'
	async((b)=>0) ;
}
