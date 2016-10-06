var AsyncFunction = require('../../nodent')().require('asyncfunction') ;

var add = new AsyncFunction("i","j","return i+j") ;

module.exports = async function() {
    return (add instanceof Function)===true
        && (add instanceof AsyncFunction)===true
        && (add.toString())
        && (add.toES5String())
        && await add(10,11)===21 ;
};
