function AClass(n){
	this.field = n ;
}

AClass.prototype.total = async function(arg) {
	await breathe() ;
	this.field += arg ;
	return this.field ;
}

AClass.prototype.barf = async function() {
	await breathe() ;
	var ex = new Error("total:"+this.field) ;
	ex.source = this ;
	throw ex ;
}

module.exports = async function() {
	/* In the ES7 Spec, async functions use Promises, which are called 
	 * in either global or undefined 'this'.
	 * 
	 *  In order to make async methods work, nodent always binds them
	 *  with .bind(this) to ensure 'this' is passed correctly through the
	 *  Promise to the resolver
	 *  
	 * See https://promisesaplus.com/#point-35 */
	var x = new AClass(100) ;
	var y = new AClass(200) ;
	var r = await x.total(23) ;
	var s = await y.total(34) ;
	try {
		var q = await x.barf() ;
	} catch (ex) {
		q = await ex.source.total(1)
	}
	return q+r+s == 481;
}
