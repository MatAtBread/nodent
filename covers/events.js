module.exports = function(nodent,opts) {
    if (!opts) opts = {} ;
    if (!opts.Promise)
        opts.Promise = global.Promise || require('../lib/thenable') ;

	var events = require('events');
	if (!events.EventEmitter.prototype.wait) {
		events.EventEmitter.prototype.wait = function(event) {
			var ee = this ;
			return new (opts.Promise)(function($return,$error) {
				ee.once(event,$return) ;
				ee.once('error',$error) ;
			}) ;
		};
	}
	return events;
};
