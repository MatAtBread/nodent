"use nodent-es7";

console.log(arguments.callee.toString()) ;

async function inc(x) {
	setTimeout($return.bind(null,x+1),300) ;
};

function test() {
	var i = 0 ;
	do {
		console.log("<",i)
		i = await inc(i) ;
		console.log(">",i)
	}
	while (i<5) ;
	console.log("ok") ;
}

test() ;