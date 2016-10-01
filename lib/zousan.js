/* This code is based on:
zousan - A Lightning Fast, Yet Very Small Promise A+ Compliant Implementation
https://github.com/bluejava/zousan
Author: Glenn Crownover <glenn@bluejava.com> (http://www.bluejava.com)
Version 2.3.2
License: MIT */
"use strict";
module.exports = function(tick){
    tick = tick || (typeof process==="object" && process.nextTick) || (typeof setImmediate==="function" && setImmediate) || function(f){setTimeout(f,0)};
    var soon = (function () {
        var fq = [], fqStart = 0, bufferSize = 1024;
        function callQueue() {
            while (fq.length - fqStart) {
                fq[fqStart]();
                fq[fqStart++] = undefined;
                if (fqStart === bufferSize) {
                    fq.splice(0, bufferSize);
                    fqStart = 0;
                }
            }
        }

        return function (fn) {
            fq.push(fn);
            if (fq.length - fqStart === 1)
                tick(callQueue);
        };
    })();

    function Zousan(func) {
        if (func) {
            var me = this;
            func(function (arg) {
                me.resolve(arg);
            }, function (arg) {
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
            var me = this;
            if (value && (typeof value === "function" || typeof value === "object")) {
                try {
                    var first = 0;
                    var then = value.then;
                    if (typeof then === "function") {
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
                if (this.c)
                    this.c.push(client);
                else
                    this.c = [client];
            } else {
                var s = this.state, a = this.v;
                soon(function () {
                    s(client, a);
                });
            }
            return p;
        }
    };

    function STATE_FULFILLED(c, arg) {
        if (typeof c.y === "function") {
            try {
                var yret = c.y.call(undefined, arg);
                c.p.resolve(yret);
            } catch (err) {
                c.p.reject(err);
            }
        } else
            c.p.resolve(arg);
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
            c.p.reject(reason);
    }

    Zousan.resolve = function (val) {
        if (val && typeof val.then==="function")
            return val ;
        var z = new Zousan();
        z.resolve(val);
        return z;
    };
    Zousan.reject = function (err) {
        if (err && typeof err.then==="function")
            return err ;
        var z = new Zousan();
        z.reject(err);
        return z;
    };
    
    Zousan.version = "2.3.2-nodent" ;
    return Zousan ;
};
