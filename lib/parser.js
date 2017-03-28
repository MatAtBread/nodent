'use strict';

var acorn = require("acorn");
var acornWalk = require("acorn/dist/walk");

var walkers = {
    AwaitExpression: function (node, st, c) {
        c(node.argument, st, "Expression");
    },
    SwitchStatement: function (node, st, c) {
        c(node.discriminant, st, "Expression");
        for (var i = 0; i < node.cases.length; ++i) {
            c(node.cases[i],st) ;
        }
    },
    SwitchCase: function (node, st, c) {
        if (node.test) c(node.test, st, "Expression");
        for (var i = 0; i < node.consequent.length; ++i) {
            c(node.consequent[i], st, "Statement");
        }
    },
    TryStatement: function (node, st, c) {
        c(node.block, st, "Statement");
        if (node.handler) c(node.handler, st, "Statement");
        if (node.finalizer) c(node.finalizer, st, "Statement");
    },
    CatchClause: function (node, st, c) {
        c(node.param, st, "Pattern");
        c(node.body, st, "ScopeBody");
    },
    Class: function (node, st, c) {
        if (node.id) c(node.id, st, "Pattern");
        if (node.superClass) c(node.superClass, st, "Expression");
        c(node.body, st);
    },
    ClassBody: function(node, st, c){
        for (var i = 0; i < node.body.length; i++) {
            c(node.body[i], st);
        }
    },
    /* Babel extensions */
    ClassProperty: function(node,st,c){
        if (node.key) c(node.key, st, "Expression");
        if (node.value) c(node.value, st, "Expression");
    },
    ClassMethod: function(node,st,c){
        if (node.key) c(node.key, st, "Expression");
        c(node, st, "Function");
    },
    ObjectProperty: function(node,st,c){
        if (node.key) c(node.key, st, "Expression");
        if (node.value) c(node.value, st, "Expression");
    },
    ObjectMethod: function(node,st,c){
        if (node.key) c(node.key, st, "Expression");
        c(node, st, "Function");
    }
} ;

var acornBase = acornWalk.make(walkers) ;

function loc(old,repl){
    ['start','end','loc','range'].forEach(function(k){
        if (k in old && !(k in repl))
            repl[k] = old[k] ;
    }) ;
}

var referencePrototypes = {
    replace: function(newNode) {
        if (Array.isArray(newNode) && newNode.length===1) newNode = newNode[0] ;
        if ('index' in this) {
            loc(this.parent[this.field][this.index], newNode);
            if (Array.isArray(newNode)) {
                [].splice.apply(this.parent[this.field],[this.index,1].concat(newNode)) ;
            } else {
                this.parent[this.field][this.index] = newNode ;
            }
        } else {
            loc(this.parent[this.field], newNode);
            if (Array.isArray(newNode)) {
                this.parent[this.field] = {type:'BlockStatement',body:newNode} ;
            } else {
                this.parent[this.field] = newNode ;
            }
        }
        return this.self ;
    },
    append: function(newNode) {
        if (Array.isArray(newNode) && newNode.length===1) newNode = newNode[0] ;
        if ('index' in this) {
            if (Array.isArray(newNode)) {
                [].splice.apply(this.parent[this.field],[this.index+1,0].concat(newNode)) ;
            } else {
                this.parent[this.field].splice(this.index+1,0,newNode) ;
            }
        } else {
            throw new Error("Cannot append Element node to non-array") ;
        }
        return this.self ;
    },
    index: function(){
        return this.parent[this.field].indexOf(this.self) ;
    },
    removeElement: function() {
        return this.parent[this.field].splice(this.index,1)[0] ;
    },
    removeNode: function() {
        var r = this.parent[this.field] ;
        delete this.parent[this.field] ;
        return r ;
    }
};

function treeWalker(n,walker,state){
    if (!state) {
        state = [{self:n}] ;
        state.replace = function(pos,newNode) {
            state[pos].replace(newNode) ;
        }
    }

    function goDown(ref) {
        ref.replace = referencePrototypes.replace ;
        ref.append = referencePrototypes.append ;
        if (ref.index) {
            Object.defineProperties(ref, {index:{enumerable:true,get:referencePrototypes.index}}) ;
            ref.remove = referencePrototypes.removeElement ;
        } else {
            ref.remove = referencePrototypes.removeNode ;
        }
        state.unshift(ref) ;
        treeWalker(ref.self,walker,state) ;
        state.shift() ;
    }

    function descend() {
        if (!(n.type in acornBase)) {
            // We don't know what type of node this is - it's not in the ESTree spec,
            // (maybe a 'react' extension?), so just ignore it
        } else {
            acornBase[n.type](n,state,function down(sub,_,derivedFrom){
                if (sub===n)
                    return acornBase[derivedFrom || n.type](n,state,down) ;

                var keys = Object.keys(n) ;
                for (var i=0; i<keys.length; i++){
                    var v = n[keys[i]] ;
                    if (Array.isArray(v)) {
                        if (v.indexOf(sub)>=0) {
                            goDown({
                                self:sub,
                                parent:n,
                                field:keys[i],
                                index:true
                            }) ;
                        }
                    } else if (v instanceof Object && sub===v) {
                        goDown({
                            self:sub,
                            parent:n,
                            field:keys[i]
                        }) ;
                    }
                }
            }) ;
        }
    } ;
    walker(n,descend,state) ;
    return n ;
}

var alreadyInstalledPlugin = false ;

function acornParse(code,config) {
    var comments = [] ;
    var options = {
        ecmaVersion:8,
        allowHashBang:true,
        allowReturnOutsideFunction:true,
        allowImportExportEverywhere:true,
        locations:true,
        onComment:comments
    } ;

    if (!(config && config.noNodentExtensions) || parseInt(acorn.version) < 4) {
        if (!alreadyInstalledPlugin) {
            require('acorn-es7-plugin')(acorn) ;
            alreadyInstalledPlugin = true ;
        }
        options.plugins = options.plugins || {} ;
        options.plugins.asyncawait = {asyncExits:true, awaitAnywhere:true} ;
    }
    
    if (config)
        for (var k in config)
            if (k !== 'noNodentExtensions')
                options[k] = config[k] ;

    var ast = acorn.parse(code,options) ;

    // attach comments to the most tightly containing node
    treeWalker(ast,function(node,descend,path){
        descend() ;
        while (comments.length && node.loc &&
            (node.loc.start.line >= comments[0].loc.start.line && node.loc.end.line>=comments[0].loc.end.line)) {
            node.$comments = node.$comments||[] ;
            node.$comments.push(comments.shift()) ;
        }
    }) ;
    return ast ;
}

var parseCache = {} ;
function partialParse(code,args) {
  if (!parseCache[code]) {
    parseCache[code] = acornParse(code,{
      noNodentExtensions:true, // The partial parser only ever parses ES5
      locations:false,
      ranges:false,
      onComment:null
    }) ;
  }

  var result = substitute(parseCache[code]) ;
  return {body:result.body, expr:result.body[0].type==='ExpressionStatement' ? result.body[0].expression : null} ;

  /* parse and substitute:
   * 
   *    $1      Substitute the specified expression. If $1 occupies a slot which is an array of expressions (e.g arguments, params)
   *            and the passed argument is an array, subtitute the whole set
   *    {$:1}   Substitute a single statement 
   * 
   */
  function substitute(src,dest) {
    if (Array.isArray(dest) && !Array.isArray(src))
        throw new Error("Can't substitute an array for a node") ;
    
    dest = dest || {} ;
    Object.keys(src).forEach(function(k){
      if (!(src[k] instanceof Object))
          return dest[k] = src[k] ;

      function moreNodes(v){ if (typeof v==="function") v = v() ; dest = dest.concat(v) ; return dest };
      function copyNode(v){ if (typeof v==="function") v = v() ; dest[k] = v ; return dest };

      // The src is an array, so create/grow the destination
      // It could an an array of expressions $1,$2,$3 or statements $:1;$:2;$:3;
      if (Array.isArray(src[k]))
          return dest[k] = substitute(src[k],[]) ;

      var p ;
      if (Array.isArray(dest)) 
          p = moreNodes ;
      else
          p = copyNode ;
          
      // Substitute a single identifier $.. with an expression (TODO: test provided arg is an expression node)
      if (src[k].type==='Identifier' && src[k].name[0]==='$') 
          return p(args[src[k].name.slice(1)]) ;

      // Substitute a single labeled statement $:.. with a statement (TODO: test provided arg is a statement node)
      if (src[k].type === 'LabeledStatement' && src[k].label.name==='$') { 
          var spec = src[k].body.expression ;
          return p(args[spec.name || spec.value]) ;
      }

      // Magic label to set call a function to modify a statement node  $$method: <statement>
      // The newNode = args.method(oldNode)
      if (src[k].type === 'LabeledStatement' && src[k].label.name.slice(0,2)==='$$') { 
          return p(args[src[k].label.name.slice(2)](substitute(src[k]).body)) ;
      }
      
      return p(substitute(src[k])) ;
    }) ;
    return dest ;
  }
}

module.exports = {
    part:partialParse,
    parse: acornParse,
    treeWalker:treeWalker
} ;
