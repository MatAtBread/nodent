var strings = "The quick brown fox jumps over the lazy dog".split(" ") ;

console.log(arguments.callee.toString()) ;

async function test() {
	try {
		async function getLength(y) {
			setImmediate(function(){
				$return(y.length) ;
			}) ;
		}
		
		var l = 0,m = 0 ;
		try {
			function length(q,cb) {
				cb(await getLength(q)) ;
			}
			strings.forEach(function(v){length(v,function(n){
				l += n ;
			})}) ;
			
			for (var i=0; i<strings.length; i++) {
				do {
					if (strings[i]) {
						m += await getLength(strings[i++]) ;
						continue ;
					}
					break ;
				}
				while(true) ;
			}
		} catch (ex) {
			return await getLength(strings[0]) ;
		}
		return m/l ;
	} catch (ex) {
		return -1 ;
	}
}

module.exports = test ;