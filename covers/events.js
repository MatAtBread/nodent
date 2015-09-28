module.exports = function(nodent) {
	var events = require('events');
	if (!events.EventEmitter.prototype.wait) {
		events.EventEmitter.prototype.wait = function(event) {
			var ee = this ;
			return new nodent.Thenable(function($return,$error) {
				ee.once(event,$return) ;
				ee.once('error',$error) ;
			}) ;
		};
	}
	return events;
};
