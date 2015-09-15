var m ;

// Conditional async function that calls back both synchronously and asynchonously, depending on the value of m
async function mode(m) {
	function complete(){
		try {
			return async undefined ;
		} catch (ex) {
			throw async ex ;
		}
	}
	
	switch (m&3) {
	case 0:
		complete() ;
		break ;
	case 1:
		setTimeout(complete,1) ;
		break ;
	case 2:
		setImmediate(complete) ;
		break ;
	case 3:
		return ;
	}
}

function checkContext(o,m,s,v) {
	if (o!==context) {
		console.error("Incorrect context",o===context,m,s,v) ;
		throw new Error("Incorrect context");
	}
}

var context = new String("ctxt") ;
context.test = async function(x,y) {
	checkContext(this,m,"test") ;
	try {
		try {
			await mode(1) ;
			checkContext(this,m,"nested") ;
			if (m&4) {
				try {
					return JSON.parse(x) ;
				} catch (jx) {
					throw 99 ;
				}
			}
			else
				return JSON.parse(x) ;
		} catch (ex) {
			checkContext(this,m,"inner",ex) ;
			await mode(2) ;
			checkContext(this,m,"caught") ;
			if (m&4) {
				try {
					return JSON.parse(y) ;
				} catch (jx) {
					throw 98 ;
				}
			} else
				return JSON.parse(y) ;
		}
	} catch (ex) {
		checkContext(this,m,"outer",ex) ;
		return "x"+x+y ;
	}
}

async function run() {
	var n = 0 ;

	debugger ;
	for (m=0; m<8; m++) {
		var r = ""+await context.test("1","2")+await context.test("3","s")+await context.test("t","4")+await context.test("u","v") ;
		if (r=="134xuv")
			n += 1 ;
	}
	return n==8;
}

module.exports = run ;
