module.exports = function(nodent,html,url,options){
	var f = [[],[]] ;
	var re = [/(.*)(<script[^>]*>)(.*)/i,/(.*)(<\/script>)(.*)/i] ;
	var m = 0 ;
	var initScript = true ;
	html = html.split("\n") ;

	for (var l=0; l<html.length; ) {
		var fragment = re[m].exec(html[l]) ;
		if (fragment) {
			if (m==0 && fragment[2].match("src="))
				fragment = null ;
		} 
		if (!fragment) {
			f[m].push(html[l++]) ;
		} else {
			if (m==1) {
				f[m].push(fragment[1]) ;
				pr = nodent.compile(f[1].join("\n"),url,3,options.compiler).code;
				if (initScript && options.runtime) {
					initScript = false ;
					if (options.runtime)
						f[0].push("Function.prototype.$asyncbind = "+nodent.$asyncbind.toString()+";\n") ;
				}
				f[0].push(pr) ;
				f[1] = [] ;
				m = 0 ;
				f[m].push(fragment[2]) ;
			} else {
				f[m].push(fragment[1]) ;
				f[m].push(fragment[2]) ;
				m = 1 ;
			}
			html[l] = fragment[3] ;
		}
	}
	return f[0].join("\n") ;
}
