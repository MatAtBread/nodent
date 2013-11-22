module.exports = function(nodent) {
	var events = require('events');
	events.EventEmitter.prototype.wait = function(event) {
		var ee = this ;
		return function($return,$error) {
			ee.once(event,$return) ;
			ee.once('error',$error) ;
		}
	};
	return events;
};
