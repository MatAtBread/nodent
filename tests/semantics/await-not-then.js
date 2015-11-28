//"use nodent-promises";

async function test() {
	return 'abc' === await 'abc' ;
}

module.exports = test ;
//test().then(console.log.bind(console),console.error.bind(console)) ;
