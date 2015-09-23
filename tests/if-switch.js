async function x(y) { return y } ;

async function run2(f) {
	if (f) {
		switch (f) {
		case 1:
			n += await x("c") ;
			return ;
		case 2:
			n += await x("d") ;
			return ;
		}
	} else return ;
}

async function run1(f) {
	if (f) {
		switch (f) {
		case 1:
			n += await x("a") ;
			break ;
		case 2:
			n += await x("b") ;
			return ;
		}
		return ;
	}
}

async function run3(f) {
	if (f)
		switch (f) {
		case 1:
			n += await x("e") ;
			break ;
		case 2:
			n += await x("f") ;
			return ;
		}
	return ;
}

async function run4(f) {
	if (f)
		switch (f) {
		case 1:
			n += await x("g") ;
			return ;
		case 2:
			n += await x("h") ;
			return ;
		}
	return ;
}

var n ;
module.exports = async function(){
	n = "" ;
	await run1(1)+await run1(2) ;
	await run2(1)+await run2(2) ;
	await run3(1)+await run3(2) ;
	await run4(1)+await run4(2) ;

	return n == "abcdefgh" ;
}
