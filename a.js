var Promise = require('./nodent').EagerThenable ;

function abc(x) {
    return (function* ($return, $error) {
        if (x) {
            throw "def";
        }
        return "abc";
    }).$asyncspawn(Promise, this);
}

;
function test1(x) {
    return (function* ($return, $error) {
        return abc(x);
    }).$asyncspawn(Promise, this);
}

var tests = [test1,function (x) {
    return (function* ($return, $error) {
        return yield abc(x);
    }).$asyncspawn(Promise, this);
},function (x) {
    return (function* ($return, $error) {
        return test1(x);
    }).$asyncspawn(Promise, this);
},function (x) {
    return abc(x);
},function (x) {
    return test1(x);
}];
function go() {
    return (function* ($return, $error) {
        var passes = 0;
        for (var i = 0;i < tests.length; i++) {
            for (var j = 0;j < 2; j++) {
                try {
                    var k = yield tests[i](j);
console.log(passes,i,j,k) ;
                    if (k === "abc") 
                        passes += 1;
                } catch (ex) {
                    if (ex === "def") 
                        passes += 1;
                }
            }
        }
console.log("passes",passes,tests.length) ;
        return passes == tests.length * 2;
    }).$asyncspawn(Promise, this);
}

var map = require('./nodent')().require('map');
function wrapMap() {
    return (function* ($return, $error) {
        var fns = tests.map(function (f) {
            return f();
        });
        var m = yield map(fns.concat(['abc']));
        var result = m.every(function (x) {
            return x === "abc";
        });
console.log("wrap",result) ;
	return result ;
    }).$asyncspawn(Promise, this);
}

function runTests() {
    return (function* ($return, $error) {
        return ((yield go()) & (yield wrapMap())) == true;
    }).$asyncspawn(Promise, this);
}

runTests().then(console.log.bind(console),console.error.bind(console)) ;

