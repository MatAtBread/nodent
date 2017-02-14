async function u() {
    function a() { 
        async return 123 ;
    }
    setImmediate(a) ;
}

async function v() {
    (function a() { 
        async return 456 ;
    })() ;
}

async function x() {
    function a() { 
        (function b() {
            async return 123 ;
        })() ;
    }
    setImmediate(a) ;
}

async function y() {
    (function a() { 
        (function b() {
            async return 456 ;
        })() ;
    })() ;
}

var z = {
    u:async function() {
        function a() { 
            async return 123 ;
        }
        setImmediate(a) ;
    },
    v:async function() {
        (function a() { 
            async return 456 ;
        })() ;
    },
    x:async function() {
        function a() { 
            (function b() {
                async return 123 ;
            })() ;
        }
        setImmediate(a) ;
    },
    y:async function() {
        (function a() { 
            (function b() {
                async return 456 ;
            })() ;
        })() ;
    }

} ;

module.exports = async function() {
    return await u() === 123 && await v() === 456 
        && await x() === 123 && await y() === 456 
        && await z.x() === 123 && await z.y() === 456 ;
}

