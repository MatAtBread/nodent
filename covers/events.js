module.exports = function(nodent) {
	var events = require('events');
	if (events.EventEmitter.prototype.wait)
		console.warn("Unable to augment EventEmitter with wait() - already defined.") ;
	events.EventEmitter.prototype.wait = function(event) {
		var ee = this ;
		return function($return,$error) {
			ee.once(event,$return) ;
			ee.once('error',$error) ;
		}
	};
	return events;
};
