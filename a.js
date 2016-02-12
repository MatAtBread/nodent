"use nodent-promise";
"use strict";

var nodent = require('./nodent')() ;
var Promise = nodent.Thenable ;

function l(x) { console.log.apply(console,arguments) ; return x }

var o = {
    a:async function() {
        return l(this.name,'a') ;
    },

    b:async function() {
        l(this.name,'b1') ;
        var n = this.name ;
        setImmediate(function(){
            async return l(n,'b2') ;
        }) ;
    },
    
    name:'Mat'
};

l('1:',await o.a(),await o.b()) ;
l('------') ;
var z = o.b() ;
l('2:',z) ;
l('3:',await z, await z) ;
l('4:',z) ;
var x = o.b() ;
x(l.bind(null,'5:',x)) ;
x.then(l.bind(null,'6:',x)) ;