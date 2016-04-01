var http = require('../../nodent')().require('http',{autoProtocol:true,Promise:Promise===DoNotTest?null:Promise}) ;

module.exports = async function() {
    var s = await http.getBody('http://nodent.mailed.me.uk/echo?ok') ;
	return s==="ok";
}
module.exports.alwaysQuick = 2 ;
