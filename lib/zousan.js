/* This code is based on:
zousan - A Lightning Fast, Yet Very Small Promise A+ Compliant Implementation
https://github.com/bluejava/zousan
Author: Glenn Crownover <glenn@bluejava.com> (http://www.bluejava.com)
Version 2.3.2
License: MIT */
"use strict";
module.exports = function(tick){
    tick = tick || (typeof process==="object" && process.nextTick) || setImmediate || function(f){setTimeout(f,0)};
    var soon = (function () {
        var fq = [], fqStart = 0, bufferSize = 1024; //  function queue; //  avoid using shift() by maintaining a start pointer - and remove items in chunks of 1024 (bufferSize)
        function callQueue() {
            while (fq.length - fqStart) { //  this approach allows new yields to pile on during the execution of these
                fq[fqStart](); //  no context or args..
                fq[fqStart++] = undefined; //  increase start pointer and dereference function just called
                if (fqStart === bufferSize) {
                    fq.splice(0, bufferSize);
                    fqStart = 0;
                }
            }
        }

        // this is the function that will be assigned to soon
        // it takes the function to call and examines all arguments
        return function (fn) {
            // push the function and any remaining arguments along with context
            fq.push(fn);
            if (fq.length - fqStart === 1)  //  upon adding our first entry, kick off the callback
                tick(callQueue);
        };
    })();
//  -------- BEGIN our main "class" definition here -------------
    function Zousan(func) {
        if (func) {
            var me = this;
            func(function (arg) { //  the resolve function bound to this context.
                me.resolve(arg);
            }, function (arg) { //  the reject function bound to this context
                me.reject(arg);
            });
        }
    }

    Zousan.prototype = {
        resolve: function (value) {
            if (this.state !== undefined) 
                return;
            if (value === this) 
                return this.reject(new TypeError("Attempt to resolve promise with self"));
            var me = this; //  preserve this
            if (value && (typeof value === "function" || typeof value === "object")) {
                try {
                    var first = 0; //  first time through?
                    var then = value.then;
                    if (typeof then === "function") {
                        // and call the value.then (which is now in "then") with value as the context and the resolve/reject functions per thenable spec
                        then.call(value, function (ra) {
                            if (!first++) {
                                me.resolve(ra);
                            }
                        }, function (rr) {
                            if (!first++) {
                                me.reject(rr);
                            }
                        });
                        return;
                    }
                } catch (e) {
                    if (!first) 
                        this.reject(e);
                    return;
                }
            }
            this.state = STATE_FULFILLED;
            this.v = value;
            if (me.c) 
                soon(function () {
                    for (var n = 0, l = me.c.length;n < l; n++) 
                        STATE_FULFILLED(me.c[n], value);
                });
        },
        reject: function (reason) {
            if (this.state !== undefined) 
                return;
            this.state = STATE_REJECTED;
            this.v = reason;
            var clients = this.c;
            if (clients) 
                soon(function () {
                    for (var n = 0, l = clients.length;n < l; n++) 
                        STATE_REJECTED(clients[n], reason);
                });
        },
        then: function (onF, onR) {
            var p = new Zousan();
            var client = {
                y: onF,
                n: onR,
                p: p
            };
            if (this.state === undefined) {
                // we are pending, so client must wait - so push client to end of this.c array (create if necessary for efficiency)
                if (this.c) 
                    this.c.push(client);
                else 
                    this.c = [client];
            } else {
                // if state was NOT pending, then we can just immediately (soon) call the resolve/reject handler
                var s = this.state, a = this.v;
                soon(function () { //  we are not pending, so yield script and resolve/reject as needed
                    s(client, a);
                });
            }
            return p;
        }
    };
//  END of prototype function list
    function STATE_FULFILLED(c, arg) {
        if (typeof c.y === "function") {
            try {
                var yret = c.y.call(undefined, arg);
                c.p.resolve(yret);
            } catch (err) {
                c.p.reject(err);
            }
        } else 
            c.p.resolve(arg); //  pass this along...
    }

    function STATE_REJECTED(c, reason) {
        if (typeof c.n === "function") {
            try {
                var yret = c.n.call(undefined, reason);
                c.p.resolve(yret);
            } catch (err) {
                c.p.reject(err);
            }
        } else 
            c.p.reject(reason); //  pass this along...
    }

//  "Class" functions follow (utility functions that live on the Zousan function object itself)
    Zousan.resolve = function (val) {
        var z = new Zousan();
        z.resolve(val);
        return z;
    };
    Zousan.reject = function (err) {
        var z = new Zousan();
        z.reject(err);
        return z;
    };
    Zousan.all = function (pa) {
        var results = [], rc = 0, retP = new Zousan(); //  results and resolved count
        function rp(p, i) {
            if (!p || typeof p.then !== "function") 
                p = Zousan.resolve(p);
            p.then(function (yv) {
                results[i] = yv;
                rc++;
                if (rc === pa.length) 
                    retP.resolve(results);
            }, function (nv) {
                retP.reject(nv);
            });
        }

        for (var x = 0;x < pa.length; x++) 
            rp(pa[x], x);
        // For zero length arrays, resolve immediately
        if (!pa.length) 
            retP.resolve(results);
        return retP;
    };

    return Zousan ;
};
