var nodent = require('../../nodent')() ;
var handler = nodent.generateRequestHandler(__dirname,null,{runtime:true,htmlScriptRegex:'\.html',compiler:{es7:true}}) ;
var req = {
	url:"/spa.html"
};
var res = {
	end:function(){},
	setHeader:function(){},
	write:console.log.bind(console)
}
handler(req,res,function(){
	console.log("done") ;
}) ;
