'use strict';

/* We manipulate (abstract syntax) trees */
var parser = require('./parser');
var outputCode = require('./output');
/** Helpers **/
function printNode(n) {
    if (!n) return '' ;
    if (Array.isArray(n))
        return n.map(printNode).join("|\n");
    try {
        return outputCode(n);
    } catch (ex) {
        return ex.message + ": " + (n && n.type);
    }
}

function cloneNode(n) {
    if (Array.isArray(n))
        return n.map(function (n) {
            return cloneNode(n);
        });
    var o = {};
    Object.keys(n).forEach(function (k) {
        o[k] = n[k];
    });
    return o;
}

/* Bit of a hack: without having to search for references to this
 * node, force it to be some replacement node */
var locationInfo = { start:true, end: true, loc: true, range: true } ;
function coerce(node, replace) {
    if (node===replace) return ;
    node.__proto__ = Object.getPrototypeOf(replace);
    Object.keys(node).forEach(function (k) {
        if (!(k in locationInfo))
            delete node[k];
    });
    Object.keys(replace).forEach(function (k) {
        if (!(k in node))
            node[k] = replace[k];
    });
}

function Nothing(){}

var examinations = {
    getScope: function(){ return  this.node.type === 'FunctionDeclaration' || this.node.type === 'FunctionExpression' || this.node.type === 'Function' || this.node.type === 'ObjectMethod' || this.node.type === 'ClassMethod' || (this.node.type === 'ArrowFunctionExpression' && this.node.body.type === 'BlockStatement') ? this.node.body.body : this.node.type === 'Program' ? this.node.body : null},
    isScope: function(){ return  this.node.type === 'FunctionDeclaration' || this.node.type === 'FunctionExpression' || this.node.type === 'Function' || this.node.type === 'Program' || this.node.type === 'ObjectMethod' || this.node.type === 'ClassMethod' || (this.node.type === 'ArrowFunctionExpression' && this.node.body.type === 'BlockStatement')},
    isFunction: function(){ return  this.node.type === 'FunctionDeclaration' || this.node.type === 'FunctionExpression' || this.node.type === 'Function' || this.node.type === 'ObjectMethod' || this.node.type === 'ClassMethod' || this.node.type === 'ArrowFunctionExpression'},
    isClass: function(){ return  this.node.type === 'ClassDeclaration' || this.node.type === 'ClassExpression'},
    isBlockStatement: function(){ return this.node.type==='ClassBody' ||  this.node.type === 'Program' || this.node.type === 'BlockStatement' ? this.node.body : this.node.type === 'SwitchCase' ? this.node.consequent : false},
    isExpressionStatement: function(){ return  this.node.type === 'ExpressionStatement'},
    isLiteral: function(){ return  this.node.type === 'Literal' || this.node.type === 'BooleanLiteral' || this.node.type === 'RegExpLiteral' || this.node.type === 'NumericLiteral' || this.node.type === 'StringLiteral' || this.node.type === 'NullLiteral'},
    isDirective: function(){ return  this.node.type === 'ExpressionStatement' && (this.node.expression.type === 'StringLiteral' || this.node.expression.type === 'Literal' && typeof this.node.expression.value === 'string')},
    isUnaryExpression: function(){ return  this.node.type === 'UnaryExpression'},
    isAwait: function(){ return  this.node.type === 'AwaitExpression' && !this.node.$hidden},
    isAsync: function(){ return  this.node.async },
    isStatement: function(){ return  this.node.type.match(/[a-zA-Z]+Declaration/) !== null || this.node.type.match(/[a-zA-Z]+Statement/) !== null},
    isExpression: function(){ return  this.node.type.match(/[a-zA-Z]+Expression/) !== null},
    isLoop: function(){ return  this.node.type === 'ForStatement' || this.node.type === 'WhileStatement' || this.node.type === 'DoWhileStatement'}, //   Other loops?
    isJump: function(){ return  this.node.type === 'ReturnStatement' || this.node.type === 'ThrowStatement' || this.node.type === 'BreakStatement' || this.node.type === 'ContinueStatement'},
    isES6: function(){
        switch (this.node.type) {
        case 'ExportNamedDeclaration':
        case 'ExportSpecifier':
        case 'ExportDefaultDeclaration':
        case 'ExportAllDeclaration':
        case 'ImportDeclaration':
        case 'ImportSpecifier':
        case 'ImportDefaultSpecifier':
        case 'ImportNamespaceSpecifier':
        case 'ArrowFunctionExpression':
        case 'ForOfStatement':
        case 'YieldExpression':
        case 'Super':
        case 'RestElement':
        case 'RestProperty':
        case 'SpreadElement':
        case 'TemplateLiteral':
        case 'ClassDeclaration':
        case 'ClassExpression':
            return true ;

        case 'VariableDeclaration':
            return this.node.kind && this.node.kind !== 'var' ;

        case 'FunctionDeclaration':
        case 'FunctionExpression':
            return !!this.node.generator;
        }
    }
};

var NodeExaminer = {} ;
Object.keys(examinations).forEach(function(k){
    Object.defineProperty(NodeExaminer,k,{
        get:examinations[k]
    }) ;
}) ;

function examine(node) {
    if (!node)
        return {};
        NodeExaminer.node = node ;
        return NodeExaminer ;
}

/*
 * descendOn = true                     Enter scopes within scopes
 * descendOn = false/undefined/null     Do not enter scopes within scopes
 * descendOn = function                 Descend when function(node) is true
 */
function contains(ast, fn, descendOn) {
    if (!ast)
        return null;
    if (fn && typeof fn === 'object') {
        var keys = Object.keys(fn);
        return contains(ast, function (node) {
            return keys.every(function (k) {
                return node[k] == fn[k];
            });
        });
    }
    var n, found = {};
    if (Array.isArray(ast)) {
        for (var i = 0;i < ast.length; i++)
            if (n = contains(ast[i], fn))
                return n;
        return null;
    }

    var subScopes = descendOn ;
    if (typeof descendOn !== "function") {
        if (descendOn) {
            subScopes = function(n) { return true } ;
        } else {
            subScopes = function(n) { return !examine(n).isScope } ;
        }
    }

    try {
        parser.treeWalker(ast, function (node, descend, path) {
            if (fn(node)) {
                found.path = path;
                throw found;
            }
            if (node === ast || subScopes(node))
                descend();
        });
    } catch (ex) {
        if (ex === found)
            return found.path;
        throw ex;
    }
    return null;
}

function containsAwait(ast) {
    return contains(ast, function(n){
        return n.type==='AwaitExpression' && !n.$hidden
    });
}

function containsAwaitInBlock(ast) {
    return contains(ast, function(n){
        return n.type==='AwaitExpression'  && !n.$hidden
    }, function (n) {
        var x = examine(n) ;
        return !x.isBlockStatement && !x.isScope
    });
}

function containsThis(ast) {
    return contains(ast, {
        type: 'ThisExpression'
    });
}

function babelLiteralNode(value) {
    if (value === null)
        return {
        type: 'NullLiteral',
        value: null,
        raw: 'null'
    };
    if (value === true || value === false)
        return {
        type: 'BooleanLiteral',
        value: value,
        raw: JSON.stringify(value)
    };
    if (value instanceof RegExp) {
        var str = value.toString();
        var parts = str.split('/');
        return {
            type: 'RegExpLiteral',
            value: value,
            raw: str,
            pattern: parts[1],
            flags: parts[2]
        };
    }
    if (typeof value === 'number')
        return {
        type: 'NumericLiteral',
        value: value,
        raw: JSON.stringify(value)
    };
    return {
        type: 'StringLiteral',
        value: value,
        raw: JSON.stringify(value)
    };
}

function ident(name, loc) {
    return {
        type: 'Identifier',
        name: name,
        loc: loc
    };
}

function idents(s) {
    var r = {};
    for (var k in s)
        r[k] = typeof s[k] === "string" ? ident(s[k]) : s[k];
        return r;
}

function asynchronize(pr, __sourceMapping, opts, logger) {
    var continuations = {};
    var generatedSymbol = 1;
    var genIdent = {};
    Object.keys(opts).filter(function (k) {
        return k[0] === '$';
    }).forEach(function (k) {
        genIdent[k.slice(1)] = ident(opts[k]);
    });

    function where(node) {
        return pr.filename + (node && node.loc && node.loc.start ? "(" + node.loc.start.line + ":" + node.loc.start.column + ")\t" : "\t");
    }

    function literal(value) {
        if (opts.babelTree) {
            return babelLiteralNode(value);
        } else {
            return {
                type: 'Literal',
                value: value,
                raw: JSON.stringify(value)
            };
        }
    }

    function getMemberFunction(node) {
        if (!node)
            return null ;
        if (opts.babelTree && (node.type === 'ClassMethod' || node.type === 'ObjectMethod')) {
            return node;
        } else if ((!opts.babelTree && node.type === 'MethodDefinition' || node.type === 'Property' && (node.method || node.kind == 'get' || node.kind == 'set')) && examine(node.value).isFunction) {
            return node.value;
        }
        return null;
    }

    var assign$Args = {
        "type": "VariableDeclaration",
        "kind": "var",
        "declarations": [{
            "type": "VariableDeclarator",
            "id": genIdent.arguments,
            "init": ident("arguments")
        }]
    };
    function replaceArguments(ast) {
        if (!ast)
            return false;
        var r = false;
        if (Array.isArray(ast)) {
            for (var i = 0;i < ast.length; i++)
                if (replaceArguments(ast[i]))
                    r = true;
            return r;
        }
        parser.treeWalker(ast, function (node, descend, path) {
            if (node.type === 'Identifier' && node.name === 'arguments') {
                node.name = opts.$arguments;
                r = true;
            } else if (node === ast || !examine(node).isFunction)
                descend();
        });
        return r;
    }

    function generateSymbol(node) {
        if (typeof node != 'string')
            node = node.type;
        return opts.generatedSymbolPrefix + node + "_" + generatedSymbol++;
    }

    function setExit(n, sym) {
        if (n) {
            n.$exit = idents({
                $error: sym.$error,
                $return: sym.$return
            });
        }
        return n;
    }

    function getExitNode(path) {
        for (var n = 0;n < path.length; n++) {
            if (path[n].self.$exit) {
                return path[n].self;
            }
            if (path[n].parent && path[n].parent.$exit) {
                return path[n].parent;
            }
        }
        return null;
    }

    function getExit(path, parents) {
        var n = getExitNode(path);
        if (n)
            return n.$exit;
        if (parents) {
            for (var i = 0;i < parents.length; i++)
                if (parents[i])
                    return idents(parents[i]);
        }
        return null;
    }

    // actually do the transforms
    if (opts.engine) {
        // Only Transform extensions:
        // - await outside of async
        // - async return <optional-expression>
        // - async throw <expression>
        // - get async id(){} / async get id(){}
        // Everything else is passed through unmolested to be run by a JS engine such as V8 v5.4
        pr.ast = asyncSpawn(pr.ast, opts.engine);
        pr.ast = exposeCompilerOpts(pr.ast);
    } else if (opts.generators) {
        // Transform to generators
        pr.ast = fixSuperReferences(pr.ast);
        pr.ast = asyncSpawn(pr.ast);
        pr.ast = exposeCompilerOpts(pr.ast);
    } else {
        // Transform to callbacks, optionally with Promises
        pr.ast = fixSuperReferences(pr.ast);
        asyncTransforms(pr.ast);
    }
    return pr;

    function asyncTransforms(ast, awaitFlag) {
        // Because we create functions (and scopes), we need all declarations before use
        blockifyArrows(ast);
        hoistDeclarations(ast);
        // All TryCatch blocks need a name so we can (if necessary) find out what the enclosing catch routine is called
        labelTryCatch(ast);
        // Convert async functions and their contained returns & throws
        asyncDefine(ast);
        asyncDefineMethod(ast);
        // Loops are asynchronized in an odd way - the loop is turned into a function that is
        // invoked through tail recursion OR callback. They are like the inner functions of
        // async functions to allow for completion and throwing
        asyncLoops(ast);
        // Handle the various JS control flow keywords by splitting into continuations that could
        // be invoked asynchronously
        mapLogicalOp(ast);
        mapCondOp(ast);
        walkDown(ast, [mapBlock,mapTryCatch,mapIfStmt,mapSwitch]);
        // Map awaits by creating continuations and passing them into the async resolver
        asyncAwait(ast, awaitFlag);
        exposeCompilerOpts(ast);
        // Remove guff generated by transpiling
        cleanCode(ast);
    }

    function makeBoundFn(name, body, argnames, binding) {
        return {
            // :> var name = function(args}{body}.$asyncbind(this)
            type: 'VariableDeclaration',
            kind: 'var',
            declarations: [{
                type: 'VariableDeclarator',
                id: ident(name),
                init: {
                    "type": "CallExpression",
                    "callee": {
                        "type": "MemberExpression",
                        "object": {
                            "type": "FunctionExpression",
                            "id": null,
                            "generator": false,
                            "expression": false,
                            "params": argnames || [],
                            "body": body
                        },
                        "property": genIdent.asyncbind,
                        "computed": false
                    },
                    "arguments": [{
                        "type": "ThisExpression"
                    },binding]
                }
            }]
        };
    }

    /* Create a 'continuation' - a block of statements that have been hoisted
     * into a named function so they can be invoked conditionally or asynchronously */
    function makeContinuation(name, body) {
        var ctn = {
            $continuation: true,
            type: name?'FunctionDeclaration':'FunctionExpression',
                id: name?typeof name==="string"?ident(name):name:undefined,
                    params: [],
                    body: {
                        type: 'BlockStatement',
                        body: cloneNode(body)
                    }
        };
        if (name) {
            continuations[name] = {
                def: ctn
            };
        }
        return ctn;
    }

    /* Generate an expression AST the immediate invokes the specified async function, e.g.
     *      (await ((async function(){ ...body... })()))
     */
    function internalIIAFE(body) {
        return {
            type: 'AwaitExpression',
            argument: asyncDefine({
                "type": "FunctionExpression",
                "generator": false,
                "expression": false,
                "async": true,
                "params": [],
                "body": {
                    "type": "BlockStatement",
                    "body": body
                }
            }).body.body[0].argument
        }
    }

    /* Used to invoke a 'continuation' - a function that represents
     * a block of statements lifted out so they can be labelled (as
     * a function definition) to be invoked via multiple execution
     * paths - either conditional or asynchronous. Since 'this' existed
     * in the original scope of the statements, the continuation function
     * must also have the correct 'this'.*/
    function thisCall(name, args) {
        if (typeof name === 'string')
            name = ident(name);
        var n = {
            "type": "CallExpression",
            "callee": {
                "type": "MemberExpression",
                "object": name,
                "property": ident('call'),
                "computed": false
            },
            "arguments": [{
                "type": "ThisExpression"
            }].concat(args || [])
        };
        name.$thisCall = n;
        n.$thisCallName = name.name;
        return n;
    }
    function returnThisCall(name,args) {
        return {
            type:'ReturnStatement',
            argument: thisCall(name,args)
        }
    }

    function deferredFinally(node, expr) {
        return {
            "type": "CallExpression",
            "callee": ident(node.$seh + "Finally"),
            "arguments": expr ? [expr] : []
        };
    }

    /**
     * returnMapper is an Uglify2 transformer that is used to change statements such as:
     *     return some-expression ;
     * into
     *     return $return(some-expression) ;
     * for the current scope only -i.e. returns nested in inner functions are NOT modified.
     *
     * This allows us to capture a normal "return" statement and actually implement it
     * by calling the locally-scoped function $return()
     */
    function mapReturns(n, path) {
        if (Array.isArray(n)) {
            return n.map(function (m) {
                return mapReturns(m, path);
            });
        }
        var lambdaNesting = 0;
        return parser.treeWalker(n, function (node, descend, path) {
            if (node.type === 'ReturnStatement' && !node.$mapped) {
                if (lambdaNesting > 0) {
                    if (!examine(node).isAsync) {
                        return descend(node);
                    }
                    delete node.async;
                }
                /* NB: There is a special case where we do a REAL return to allow for chained async-calls and synchronous returns
                 *
                 * The selected syntax for this is:
                 *   return void (expr) ;
                 * which is mapped to:
                 *   return (expr) ;
                 *
                 * Note that the parenthesis are necessary in the case of anything except a single symbol as "void" binds to
                 * values before operator. In the case where we REALLY want to return undefined to the callback, a simple
                 * "return" or "return undefined" works.
                 *
                 * There is an argument for only allowing this exception in es7 mode, as Promises and generators might (one day)
                 * get their own cancellation method.
                 * */
                node.$mapped = true;
                if (examine(node.argument).isUnaryExpression && node.argument.operator === "void") {
                    node.argument = node.argument.argument;
                } else {
                    node.argument = {
                        "type": "CallExpression",
                        callee: getExit(path, [opts]).$return,
                        "arguments": node.argument ? [node.argument] : []
                    };
                }
                return;
            } else if (node.type === 'ThrowStatement') {
                if (lambdaNesting > 0) {
                    if (!examine(node).isAsync) {
                        return descend(node);
                    }
                    delete node.async;
                }
                node.type = 'ReturnStatement';
                node.$mapped = true;
                node.argument = {
                    type: 'CallExpression',
                    callee: getExit(path, [opts]).$error,
                    arguments: [node.argument]
                };
                return;
            } else if (examine(node).isFunction) {
                lambdaNesting++;
                descend(node);
                lambdaNesting--;
                return;
            } else {
                descend(node);
                return;
            }
        }, path);
    }

    /*
    To implement conditional execution, a?b:c is mapped to

      await (async function(){ if (a) return b ; return c })

      Note that 'await (async function(){})()' can be optimized to a Thenable since no args are passed
     */
    function mapCondOp(ast, state) {
        if (Array.isArray(ast))
            return ast.map(function (n) {
                return mapCondOp(n, state);
            });
        parser.treeWalker(ast, function (node, descend, path) {
            descend();
            if (node.type === 'ConditionalExpression' && (containsAwait(node.alternate) || containsAwait(node.consequent))) {
                var z = ident(generateSymbol("condOp"));
                var xform = internalIIAFE([
                                           {
                                               "type": "IfStatement",
                                               "test": node.test,
                                               "consequent": {
                                                   "type": "ReturnStatement",
                                                   "argument": node.consequent
                                               },
                                               "alternate": null
                                           },
                                           {
                                               "type": "ReturnStatement",
                                               "argument": node.alternate
                                           }
                                           ]) ;
                coerce(node, xform);
            }
        }, state);
        return ast;
    }

    /*
      To implement conditional execution, logical operators with an awaited RHS are mapped thus:

        Translate a || b into await (async function Or(){ var z ; if (!(z=a)) z=b ; return z })
        Translate a && b into await (async function And(){ var z ; if (z=a) z=b ; return z })

        Note that 'await (async function(){})()' can be optimized to a Thenable since no args are passed
     */
    function mapLogicalOp(ast, state) {
        if (Array.isArray(ast))
            return ast.map(function (n) {
                return mapLogicalOp(n, state);
            });
        parser.treeWalker(ast, function (node, descend, path) {
            function awaitedTest(truthy, falsy) {
                return internalIIAFE([{
                    "type": "VariableDeclaration",
                    "declarations": [{
                        "type": "VariableDeclarator",
                        "id": z,
                        "init": null
                    }],
                    "kind": "var"
                },{
                    "type": "IfStatement",
                    "test": truthy,
                    "consequent": falsy,
                    "alternate": null
                },{
                    "type": "ReturnStatement",
                    "argument": z
                }]) ;
            }

            descend();
            if (node.type === 'LogicalExpression' && containsAwait(node.right)) {
                var xform;
                var z = ident(generateSymbol("logical" + (node.operator === '&&' ? "And" : "Or")));

                if (node.operator === '||') {
                    xform = awaitedTest({
                        "type": "UnaryExpression",
                        "operator": "!",
                        "prefix": true,
                        "argument": {
                            "type": "AssignmentExpression",
                            "operator": "=",
                            "left": z,
                            "right": node.left
                        }
                    }, {
                        "type": "ExpressionStatement",
                        "expression": {
                            "type": "AssignmentExpression",
                            "operator": "=",
                            "left": z,
                            "right": node.right
                        }
                    });
                } else if (node.operator === '&&') {
                    xform = awaitedTest({
                        "type": "AssignmentExpression",
                        "operator": "=",
                        "left": z,
                        "right": node.left
                    }, {
                        "type": "ExpressionStatement",
                        "expression": {
                            "type": "AssignmentExpression",
                            "operator": "=",
                            "left": z,
                            "right": node.right
                        }
                    });
                } else
                    throw new Error(where(node) + "Illegal logical operator: "+node.operator);
                coerce(node, xform);
            }
        }, state);
        return ast;
    }

    function mapBlock(block, path, down) {
        if (block.type !== "SwitchCase" && examine(block).isBlockStatement) {
            var idx = 0 ;
            while (idx < block.body.length) {
                var node = block.body[idx] ;
                if (node.type !== "SwitchCase" && examine(node).isBlockStatement) {
                    var blockScoped = containsBlockScopedDeclarations(node.body) ;
                    if (!blockScoped) {
                        block.body.splice.apply(block.body,[idx,1].concat(node.body));
                    } else {
                        if (containsAwaitInBlock(node)) {
                            var symName = generateSymbol(node);
                            var deferredCode = block.body.splice(idx + 1, block.body.length - (idx + 1));
                            if (deferredCode.length) {
                                var ctn = makeContinuation(symName, deferredCode);
                                delete continuations[symName] ;
                                node.body.push(returnThisCall(symName));
                                block.body.push(ctn) ;
                                idx++ ;
                            } else idx++ ;
                        } else idx++ ;
                    }
                } else idx++ ;
            }
        }
    }

    /*
     * Translate:
  if (x) { y; } more... ;
     * into
  if (x) { y; return $more(); } function $more() { more... } $more() ;
     *
     * ...in case 'y' uses await, in which case we need to invoke $more() at the end of the
     * callback to continue execution after the case.
     */
    function mapIfStmt(ifStmt, path, down) {
        if (ifStmt.type === 'IfStatement' && containsAwait([ifStmt.consequent,ifStmt.alternate])) {
            var symName = generateSymbol(ifStmt);
            var ref = path[0];
            var synthBlock = {
                type: 'BlockStatement',
                body: [ifStmt]
            };
            if ('index' in ref) {
                var idx = ref.index;
                var deferredCode = ref.parent[ref.field].splice(idx + 1, ref.parent[ref.field].length - (idx + 1));
                ref.replace(synthBlock);
                if (deferredCode.length) {
                    var call = returnThisCall(symName);
                    synthBlock.body.unshift(down(makeContinuation(symName, deferredCode)));
                    [ifStmt.consequent,ifStmt.alternate].forEach(function (cond) {
                        if (!cond)
                            return;
                        var blockEnd;
                        if (!examine(cond).isBlockStatement)
                            blockEnd = cond;
                        else
                            blockEnd = cond.body[cond.body.length - 1];
                        if (!(blockEnd && blockEnd.type === 'ReturnStatement')) {
                            if (!(cond.type === 'BlockStatement')) {
                                coerce(cond, {
                                    type: 'BlockStatement',
                                    body: [cloneNode(cond)]
                                });
                            }
                            cond.$deferred = true;
                            cond.body.push(cloneNode(call));
                        }
                        down(cond);
                    });
                    // If both blocks are transformed, the trailing call to $post_if()
                    // can be omitted as it'll be unreachable via a synchronous path
                    if (!(ifStmt.consequent && ifStmt.alternate && ifStmt.consequent.$deferred && ifStmt.alternate.$deferred))
                        synthBlock.body.push(cloneNode(call));
                }
            } else {
                ref.parent[ref.field] = synthBlock;
            }
        }
    }

    function mapSwitch(switchStmt, path, down) {
        if (!switchStmt.$switched && switchStmt.type === 'SwitchStatement' && containsAwait(switchStmt.cases)) {
            switchStmt.$switched = true;
            var symName, deferred, deferredCode, ref = path[0];
            if ('index' in ref) {
                var j = ref.index + 1;
                deferredCode = ref.parent[ref.field].splice(j, ref.parent[ref.field].length - j);
                if (deferredCode.length && deferredCode[deferredCode.length - 1].type === 'BreakStatement')
                    ref.parent[ref.field].push(deferredCode.pop());
                symName = generateSymbol(switchStmt);
                deferred = returnThisCall(symName);
                ref.parent[ref.field].unshift(makeContinuation(symName, deferredCode));
                ref.parent[ref.field].push(cloneNode(deferred));
            }
            // Now transform each case so that 'break' looks like return <deferred>
            switchStmt.cases.forEach(function (caseStmt, idx) {
                if (!(caseStmt.type === 'SwitchCase')) {
                    throw new Error("switch contains non-case/default statement: " + caseStmt.type);
                }
                if (containsAwait(caseStmt.consequent)) {
                    var end = caseStmt.consequent[caseStmt.consequent.length - 1];
                    if (end.type === 'BreakStatement') {
                        caseStmt.consequent[caseStmt.consequent.length - 1] = cloneNode(deferred) ;
                    } else if (end.type === 'ReturnStatement' || end.type === 'ThrowStatement') {} else {
                        // Do nothing - block ends in return or throw
                        logger(where(caseStmt) + "switch-case fall-through not supported - added break. See https://github.com/MatAtBread/nodent#differences-from-the-es7-specification");
                        caseStmt.consequent.push(cloneNode(deferred));
                    }
                }
            });
            return true;
        }
    }

    /* Give unique names to TryCatch blocks */
    function labelTryCatch(ast) {
        parser.treeWalker(ast, function (node, descend, path) {
            if (node.type === 'TryStatement' && containsAwait(node)) {
                // Every try-catch needs a name, so asyncDefine/asyncAwait knows who's handling errors
                node.$containedAwait = true ;
                var parent = getExit(path, [opts]);
                node.$seh = generateSymbol("Try") + "_";
                if (node.finalizer && !node.handler) {
                    // We have a finally, but no 'catch'. Create the default catch clause 'catch(_ex) { throw _ex }'
                    var exSym = ident(generateSymbol("exception"));
                    node.handler = {
                        "type": "CatchClause",
                        "param": exSym,
                        "body": {
                            "type": "BlockStatement",
                            "body": [{
                                "type": "ThrowStatement",
                                "argument": exSym
                            }]
                        }
                    };
                }
                if (!node.handler && !node.finalizer) {
                    var ex = new SyntaxError(where(node.value) + "try requires catch and/or finally clause", pr.filename, node.start);
                    ex.pos = node.start;
                    ex.loc = node.loc.start;
                    throw ex;
                }
                if (node.finalizer) {
                    setExit(node.block, {
                        $error: node.$seh + "Catch",
                        $return: deferredFinally(node, parent.$return)
                    });
                    setExit(node.handler, {
                        $error: deferredFinally(node, parent.$error),
                        $return: deferredFinally(node, parent.$return)
                    });
                } else {
                    setExit(node.block, {
                        $error: node.$seh + "Catch",
                        $return: parent.$return
                    });
                }
            }
            descend();
        });
        return ast;
    }

    function afterDirectives(body,nodes) {
        for (var i=0; i<body.length; i++) {
            if (examine(body[i]).isDirective)
                continue ;
            body.splice.apply(body,[i,0].concat(nodes)) ;
            return ;
        }
        body.splice.apply(body,[body.length,0].concat(nodes)) ;
    }

    function mapTryCatch(node, path, down) {
        if (node.type === 'TryStatement' && (node.$containedAwait || containsAwait(node)) && !node.$mapped) {
            var continuation, ctnName, catchBody;
            var ref = path[0];
            if ('index' in ref) {
                var i = ref.index + 1;
                var afterTry = ref.parent[ref.field].splice(i, ref.parent[ref.field].length - i);
                if (afterTry.length) {
                    ctnName = node.$seh + "Post";
                    var afterContinuation = makeContinuation(ctnName, afterTry);
                    afterContinuation = down(afterContinuation);
                    ref.parent[ref.field].splice(ref.index,0,afterContinuation);
                    continuation = returnThisCall(node.finalizer ? deferredFinally(node, ident(ctnName)) : ctnName);
                } else if (node.finalizer) {
                    continuation = returnThisCall(deferredFinally(node));
                }
            } else {
                throw new Error(pr.filename + " - malformed try/catch blocks");
            }
            node.$mapped = true;
            if (continuation) {
                node.block.body.push(cloneNode(continuation));
                node.handler.body.body.push(cloneNode(continuation));
            }
            var binding = getExit(path, [opts]);
            if (node.handler) {
                var symCatch = ident(node.$seh + "Catch");
                catchBody = cloneNode(node.handler.body);
                var catcher = makeBoundFn(symCatch.name, catchBody, [cloneNode(node.handler.param)], node.finalizer ? deferredFinally(node, binding.$error) : binding.$error);
                node.handler.body.body = [{
                    type: 'CallExpression',
                    callee: symCatch,
                    arguments: [cloneNode(node.handler.param)]
                }];
                ref.parent[ref.field].splice(ref.index,0,catcher) ;
            }
            if (node.finalizer) {
                var finalizer = {
                    type: "VariableDeclaration",
                    kind: "var",
                    declarations: [{
                        type: "VariableDeclarator",
                        id: ident(node.$seh + "Finally"),
                        init: {
                            type: "CallExpression",
                            callee: {
                                type: "MemberExpression",
                                object: {
                                    type: 'FunctionExpression',
                                    params: [ident(node.$seh + "Exit")],
                                    body: {
                                        type: 'BlockStatement',
                                        body: [{
                                            type: 'ReturnStatement',
                                            argument: {
                                                type: 'CallExpression',
                                                arguments: [{
                                                    type: 'ThisExpression'
                                                },binding.$error],
                                                callee: {
                                                    type: 'MemberExpression',
                                                    property: genIdent.asyncbind,
                                                    object: {
                                                        type: 'FunctionExpression',
                                                        params: [ident(node.$seh + "Value")],
                                                        body: {
                                                            type: 'BlockStatement',
                                                            body: cloneNode(node.finalizer.body).concat([{
                                                                type: 'ReturnStatement',
                                                                argument: {
                                                                    type: 'BinaryExpression',
                                                                    operator: '&&',
                                                                    left: ident(node.$seh + "Exit"),
                                                                    right: thisCall(ident(node.$seh + "Exit"), [ident(node.$seh + "Value")])
                                                                }
                                                            }])
                                                        }
                                                    }
                                                }
                                            }
                                        }]
                                    }
                                },
                                "property": genIdent.asyncbind,
                                "computed": false
                            },
                            "arguments": [{
                                "type": "ThisExpression"
                            }]
                        }
                    }]
                };
                afterDirectives(ref.parent[ref.field],[finalizer]);
                var callFinally = returnThisCall(deferredFinally(node, ctnName && ident(ctnName))) ;
                catchBody.body[catchBody.length - 1] = callFinally;
                node.block.body[node.block.body.length - 1] = callFinally;
                delete node.finalizer;
            }
        }
    }

    function walkDown(ast, mappers, state) {
        var walked = [];

        function closedWalk(ast,state) {
            return parser.treeWalker(ast, function (node, descend, path) {
                function walkDownSubtree(node) {
                    return closedWalk(node, path);
                }

                if (walked.indexOf(node) < 0) {
                    walked.push(node) ;
                    mappers.forEach(function (m) {
                        m(node, path, walkDownSubtree);
                    });
                }
                descend();
                return;
            }, state);
        }

        closedWalk(ast,state)
        return ast ;
    }

    function asyncAwait(ast, inAsync, parentCatcher) {
        parser.treeWalker(ast, function (node, descend, path) {
            if (node.type == 'IfStatement') {
                if (node.consequent.type != 'BlockStatement' && containsAwait(node.consequent))
                    node.consequent = {
                    type: 'BlockStatement',
                    body: [node.consequent]
                };
                if (node.alternate && node.alternate.type != 'BlockStatement' && containsAwait(node.alternate))
                    node.alternate = {
                    type: 'BlockStatement',
                    body: [node.alternate]
                };
            }
            descend();
            if (examine(node).isAwait) {
                var loc = node.loc;
                /* Warn if this await expression is not inside an async function, as the return
                 * will depend on the Thenable implementation, and references to $return might
                 * not resolve to anything */
                inAsync = inAsync || path.some(function (ancestor) {
                    return ancestor.self && ancestor.self.$wasAsync;
                });
                if (!inAsync || inAsync === "warn") {
                    var errMsg = where(node) + "'await' used inside non-async function. ";
                    if (opts.promises)
                        errMsg += "'return' value Promise runtime-specific";
                    else
                        errMsg += "'return' value from await is synchronous";
                    logger(errMsg + ". See https://github.com/MatAtBread/nodent#differences-from-the-es7-specification");
                }
                var parent = path[0].parent;
                if (parent.type === 'LogicalExpression' && parent.right === node) {
                    logger(where(node.argument) + "'" + printNode(parent) + "' on right of " + parent.operator + " will always evaluate '" + printNode(node.argument) + "'");
                }
                if (parent.type === 'ConditionalExpression' && parent.test !== node) {
                    logger(where(node.argument) + "'" + printNode(parent) + "' will always evaluate '" + printNode(node.argument) + "'");
                }
                var result = ident(generateSymbol("await"));
                var expr = cloneNode(node.argument);
                coerce(node, result);
                // Find the statement containing this await expression (and it's parent)
                var stmt, body;
                for (var n = 1;n < path.length; n++) {
                    if (body = examine(path[n].self).isBlockStatement) {
                        stmt = path[n - 1];
                        break;
                    }
                }
                if (!stmt)
                    throw new Error(where(node) + "Illegal await not contained in a statement");
                var containingExits = getExit(path, [parentCatcher,opts]);
                var i = stmt.index;
                var callback, callBack = body.splice(i, body.length - i).slice(1);
                var returner;
                // If stmt is of the form 'return fn(result.name)', just replace it a
                // reference to 'fn'.
                if (stmt.self.type === 'ReturnStatement' && stmt.self.argument.type === 'CallExpression' && stmt.self.argument.arguments.length === 1 && stmt.self.argument.arguments[0].name === result.name) {
                    returner = (callback = stmt.self.argument.callee);
                    // If stmt is only a reference to the result, suppress the result
                    // reference as it does nothing
                } else if (!(stmt.self.type === 'Identifier' || stmt.self.name === result.name || stmt.self.type === 'ExpressionStatement' && stmt.self.expression.type === 'Identifier' && stmt.self.expression.name === result.name)) {
                    callBack.unshift(stmt.self);
                    callback = {
                        type: 'FunctionExpression',
                        params: [cloneNode(result)],
                        body: asyncAwait({
                            type: 'BlockStatement',
                            body: cloneNode(callBack)
                        }, inAsync, containingExits)
                    };
                } else {
                    if (callBack.length)
                        callback = {
                        type: 'FunctionExpression',
                        params: [cloneNode(result)],
                        body: asyncAwait({
                            type: 'BlockStatement',
                            body: cloneNode(callBack)
                        }, inAsync, containingExits)
                    };
                    else
                        callback = {
                        type: 'FunctionExpression',
                        params: [],
                        body: {
                            type: 'BlockStatement',
                            body: []
                        }
                    };
                }
                // Wrap the callback statement(s) in a Block and transform them
                if (!returner) {
                    if (callback) {
                        returner = {
                            type: 'CallExpression',
                            callee: {
                                type: 'MemberExpression',
                                object: callback,
                                property: ident('$asyncbind', loc),
                                computed: false
                            },
                            arguments: [{
                                type: 'ThisExpression'
                            },containingExits.$error]
                        };
                    } else {
                        returner = {
                            type: 'FunctionExpression',
                            params: [],
                            body: {
                                type: 'BlockStatement',
                                body: []
                            }
                        };
                    }
                }
                if (opts.wrapAwait) {
                    if (opts.promises || opts.generators) {
                        expr = {
                            type: 'CallExpression',
                            arguments: [expr],
                            callee: {
                                type: 'MemberExpression',
                                object: ident('Promise'),
                                property: ident('resolve')
                            }
                        };
                    } else {
                        // ES7 makeThenable
                        expr = {
                            type: 'CallExpression',
                            arguments: [expr],
                            callee: {
                                type: 'MemberExpression',
                                object: ident('Object'),
                                property: ident('$makeThenable')
                            }
                        };
                    }
                }
                var exitCall = {
                    type: 'CallExpression',
                    callee: {
                        type: 'MemberExpression',
                        object: expr,
                        property: ident('then', loc),
                        computed: false
                    },
                    arguments: [returner,containingExits.$error]
                };
                body.push({
                    loc: loc,
                    type: 'ReturnStatement',
                    argument: exitCall
                });
            }
            return true;
        });
        return ast;
    }

    // Transform a for..in into it's iterative equivalent
    function transformForIn(node, path) {
        var i = ident(generateSymbol("in"));
        var it = node.left.type === 'VariableDeclaration' ? node.left.declarations[0].id : node.left;
        var init = {
            "type": "VariableDeclaration",
            "declarations": [{
                "type": "VariableDeclarator",
                "id": i,
                "init": {
                    "type": "ArrayExpression",
                    "elements": []
                }
            }],
            "kind": "var"
        };
        var body = node.body;
        node.body = {
            "type": "ExpressionStatement",
            "expression": {
                "type": "CallExpression",
                "callee": {
                    "type": "MemberExpression",
                    "object": i,
                    "property": ident('push'),
                    "computed": false
                },
                "arguments": [it]
            }
        };
        var indexAssign = {
            "type": "ExpressionStatement",
            "expression": {
                "type": "AssignmentExpression",
                "operator": "=",
                "left": it,
                "right": {
                    "type": "CallExpression",
                    "callee": {
                        "type": "MemberExpression",
                        "object": i,
                        "property": ident('shift'),
                        "computed": false
                    },
                    "arguments": []
                }
            }
        };
        if (body.type === 'BlockStatement') {
            body.body.unshift(indexAssign);
        } else {
            body = {
                "type": "BlockStatement",
                "body": [indexAssign].concat(body)
            };
        }
        var loop = {
            "type": "WhileStatement",
            "test": {
                "type": "MemberExpression",
                "object": i,
                "property": ident('length'),
                "computed": false
            },
            "body": body
        };
        //        var parent = path[0].parent[path[0].ref] ;
        if ('index' in path[0]) {
            path[0].parent.body.splice(path[0].index, 1, init, node, loop);
        } else {
            path[0].parent[path[0].ref] = {
                type: 'BlockStatement',
                body: [init,node,loop]
            };
        }
    }

    // Transform a for..of into it's iterative equivalent
    function iterizeForOf(node, path) {
        node.type = 'ForStatement';
        if (node.body.type !== 'BlockStatement') {
            node.body = {
                type: 'BlockStatement',
                body: [node.body]
            };
        }
        var index, iterator, initIterator = {
            "type": "ArrayExpression",
            "elements": [{
                "type": "CallExpression",
                "callee": {
                    "type": "MemberExpression",
                    "object": node.right,
                    "property": {
                        "type": "MemberExpression",
                        "object": ident("Symbol"),
                        "property": ident("iterator"),
                        "computed": false
                    },
                    "computed": true
                },
                "arguments": []
            }]
        };
        if (node.left.type === 'VariableDeclaration') {
            if (node.left.kind==='const')
                node.left.kind = 'let' ;

            index = node.left.declarations[0].id ;
            var decls = getDeclNames(node.left.declarations[0].id) ;
            iterator = ident("$iterator_" + decls.join('_'));

            node.left.declarations = decls.map(function(name){
                return {
                    type: "VariableDeclarator",
                    id: ident(name)
                } ;
            }) ;
            node.left.declarations.push({
                type: "VariableDeclarator",
                id: iterator,
                init: initIterator
            });
            node.init = node.left;
        } else {
            index = node.left;
            iterator = ident("$iterator_" + index.name);
            var declaration = {
                type: 'VariableDeclaration',
                kind: 'var',
                declarations: [{
                    type: "VariableDeclarator",
                    id: iterator,
                    init: initIterator
                }]
            };
            path[0].parent.body.splice(path[0].index, 0, declaration);
            node.init = null;
        }
        node.test = {
            "type": "LogicalExpression",
            "left": {
                "type": "UnaryExpression",
                "operator": "!",
                "prefix": true,
                "argument": {
                    "type": "MemberExpression",
                    "object": {
                        "type": "AssignmentExpression",
                        "operator": "=",
                        "left": {
                            "type": "MemberExpression",
                            "object": iterator,
                            "property": literal(1),
                            "computed": true
                        },
                        "right": {
                            "type": "CallExpression",
                            "callee": {
                                "type": "MemberExpression",
                                "object": {
                                    "type": "MemberExpression",
                                    "object": iterator,
                                    "property": literal(0),
                                    "computed": true
                                },
                                "property": ident('next'),
                                "computed": false
                            },
                            "arguments": []
                        }
                    },
                    "property": ident('done'),
                    "computed": false
                }
            },
            "operator": "&&",
            "right": {
                type: 'LogicalExpression',
                "operator": "||",
                left: {
                    "type": "AssignmentExpression",
                    "operator": "=",
                    "left": index,
                    "right": {
                        "type": "MemberExpression",
                        "object": {
                            "type": "MemberExpression",
                            "object": iterator,
                            "property": literal(1),
                            "computed": true
                        },
                        "property": ident('value'),
                        "computed": false
                    }
                },
                right: literal(true)
            }
        };
        delete node.left;
        delete node.right;
    }

    /* Map loops */
    function asyncLoops(ast) {
        parser.treeWalker(ast, function (node, descend, path) {
            function mapContinue(label) {
                return {
                    type: 'ReturnStatement',
                    argument: {
                        type: 'UnaryExpression',
                        operator: 'void',
                        prefix: true,
                        argument: thisCall(label || symContinue)
                    }
                };
            };
            function mapExits(n, descend) {
                if (n.type === 'BreakStatement') {
                    coerce(n, cloneNode(mapBreak(n.label && opts.generatedSymbolPrefix + node.type + "_" + n.label.name + "_exit")));
                } else if (n.type === 'ContinueStatement') {
                    coerce(n, cloneNode(mapContinue(n.label && opts.generatedSymbolPrefix + node.type + "_" + n.label.name + "_next")));
                } else if (examine(n).isFunction) {
                    return true;
                }
                descend();
            }

            if (node.type === 'ForInStatement' && containsAwait(node)) {
                transformForIn(node, path);
            } else if (node.type === 'ForOfStatement' && containsAwait(node)) {
                iterizeForOf(node, path);
            }
            descend();
            var p;
            if (examine(node).isLoop && containsAwait(node)) {
                var init = node.init;
                var condition = node.test || literal(true);
                var step = node.update;
                var body = node.body;
                var loopUsesThis = containsThis(body) ;
                if (init) {
                    if (!examine(init).isStatement) {
                        init = {
                            type: 'ExpressionStatement',
                            expression: init
                        };
                    }
                }
                step = step && {
                    type: 'ExpressionStatement',
                    expression: step
                } ;
                body = examine(body).isBlockStatement ? cloneNode(body).body : [cloneNode(body)];
                var label = path[0].parent.type === 'LabeledStatement' && path[0].parent.label.name;
                label = node.type + "_" + (label || generatedSymbol++);
                var symExit = opts.generatedSymbolPrefix + (label + "_exit");
                var symContinue = opts.generatedSymbolPrefix + (label + "_next");
                var loop = ident(opts.generatedSymbolPrefix + (label + "_loop"));
                // How to exit the loop
                var mapBreak = function (label) {
                    return {
                        type: 'ReturnStatement',
                        argument: {
                            type: 'UnaryExpression',
                            operator: 'void',
                            prefix: true,
                            argument: {
                                type: 'CallExpression',
                                callee: ident(label || symExit),
                                arguments: []
                            }
                        }
                    };
                };

                // How to continue the loop
                var defContinue = makeContinuation(symContinue, [{
                    type: 'ReturnStatement',
                    argument: {
                        type: 'CallExpression',
                        callee: loopUsesThis?{
                            type: 'CallExpression',
                            arguments: [{
                                type: 'ThisExpression'
                            }],
                            callee: {
                                type: 'MemberExpression',
                                object: loop,
                                property: genIdent.asyncbind,
                                computed: false
                            }
                        }:loop,
                        arguments: [ident(symExit),genIdent.error]
                    }
                }]);
                if (step)
                    defContinue.body.body.unshift(step);
                for (var i = 0;i < body.length; i++) {
                    parser.treeWalker(body[i], mapExits);
                }
                body.push(cloneNode(mapContinue()));
                var subCall = {
                    type: 'FunctionExpression',
                    id: loop,
                    params: [ident(symExit),genIdent.error],
                    body: {
                        type: 'BlockStatement',
                        body: [defContinue]
                    }
                };
                if (node.type === 'DoWhileStatement') {
                    defContinue.body.body = [{
                        type: 'IfStatement',
                        test: cloneNode(condition),
                        consequent: {
                            type: 'BlockStatement',
                            body: cloneNode(defContinue.body.body)
                        },
                        alternate: {
                            type: 'ReturnStatement',
                            argument: {
                                type: 'CallExpression',
                                callee: ident(symExit),
                                arguments: []
                            }
                        }
                    }];
                    subCall.body.body = [defContinue].concat(body);
                } else {
                    var nextTest = {
                        type: 'IfStatement',
                        test: cloneNode(condition),
                        consequent: {
                            type: 'BlockStatement',
                            body: body
                        },
                        alternate: cloneNode(mapBreak())
                    };
                    subCall.body.body.push(nextTest);
                }
                var replace = {
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'AwaitExpression',
                        argument: {
                            type: 'CallExpression',
                            arguments: [{ type: 'ThisExpression' }],
                            callee: {
                                type: 'MemberExpression',
                                object: subCall,
                                property: genIdent.asyncbind,
                                computed: false
                            }
                        }
                    }
                };

                if (init && init.type==='VariableDeclaration' && (init.kind==='let' || init.kind==='const')) {
                    if (init.kind==='const')
                        init.kind = 'let' ;
                    replace = {
                        type:'BlockStatement',
                        body:[cloneNode(init),replace]
                    };
                    init = null ;
                }

                for (p = 0; p < path.length; p++) {
                    var ref = path[p];
                    if ('index' in ref) {
                        if (init) {
                            ref.parent[ref.field].splice(ref.index, 1, cloneNode(init), replace);
                        } else {
                            ref.parent[ref.field][ref.index] = replace;
                        }
                        return true;
                    }
                }
            }
            return true;
        });
        return ast;
    }

    function containsAsyncExit(ast) {
        try {
            if (Array.isArray(ast)) {
                return ast.some(containsAsyncExit);
            }
            // For each function in this ast....
            parser.treeWalker(ast, function (node, descend, path) {
                if (node.type === 'Identifier' && (node.name === opts.$return || node.name === opts.$error)) {
                    throw node;
                }
                if (examine(node).isFunction) {
                    var f = contains(node, function (node) {
                        // Legacy reference to $return or $error - treat as if there is an asyncExit (it might be)
                        // so we behave as previous releases did
                        if (node.type === 'Identifier' && (node.name === opts.$return || node.name === opts.$error)) {
                            throw node;
                        }
                        if (node.type === 'ReturnStatement' || node.type === 'ThrowStatement') {
                            if (examine(node).isAsync) {
                                throw node;
                            }
                        }
                    });
                    if (f) {
                        throw f;
                    }
                    return false;
                } else
                    descend();
            });
            return false;
        } catch (ex) {
            return ex;
        }
    }

    // TODO: Hoist directives (as in asyncDefine)
    function asyncDefineMethod(ast) {
        return parser.treeWalker(ast, function (node, descend, path) {
            var transform = getMemberFunction(node);
            descend();
            if (!transform || !examine(transform).isAsync)
                return;
            if (node.kind == 'set') {
                var ex = new SyntaxError(where(transform) + "method 'async set' cannot be invoked", pr.filename, node.start);
                ex.pos = node.start;
                ex.loc = node.loc.start;
                throw ex;
            }

            transform.async = false;
            var usesArgs = replaceArguments(transform);
            if (!containsAsyncExit(transform) && (transform.body.body.length === 0 || transform.body.body[transform.body.body.length - 1].type !== 'ReturnStatement')) {
                transform.body.body.push({
                    type: 'ReturnStatement'
                });
            }
            var funcback = {
                type: 'CallExpression',
                arguments: [{
                    type: 'ThisExpression'
                }],
                callee: {
                    type: 'MemberExpression',
                    object: setExit({
                        type: 'FunctionExpression',
                        params: [genIdent.return,genIdent.error],
                        body: asyncDefineMethod(mapReturns(transform.body, path)),
                        $wasAsync: true
                    }, opts),
                    property: genIdent.asyncbind,
                    computed: false
                }
            };
            if (opts.promises) {
                transform.body = {
                    type: 'BlockStatement',
                    body: [{
                        type: 'ReturnStatement',
                        argument: {
                            type: 'NewExpression',
                            callee: ident('Promise'),
                            arguments: [funcback]
                        }
                    }]
                };
            } else {
                if (!opts.lazyThenables)
                    funcback.arguments.push(literal(true));
                transform.body = {
                    type: 'BlockStatement',
                    body: [{
                        type: 'ReturnStatement',
                        argument: funcback
                    }]
                };
            }
            if (usesArgs) {
                afterDirectives(transform.body.body,[assign$Args]);
            }
        });
    }

    function asyncDefine(ast,noUndefinedReturn) {
        parser.treeWalker(ast, function (node, descend, path) {
            descend();
            if (examine(node).isAsync && examine(node).isFunction) {
                var member ;
                if ((member = getMemberFunction(path[0].parent))
                    && examine(member).isAsync && path[0].parent.kind === 'get')  {
                    warnAsyncGetter(path[0].parent.key) ;
                }
                delete node.async;
                var fnBody;
                var usesArgs = replaceArguments(node);
                if (examine(node.body).isBlockStatement) {
                    if (!noUndefinedReturn && !containsAsyncExit(node.body) && (node.body.body.length === 0 || node.body.body[node.body.body.length - 1].type !== 'ReturnStatement')) {
                        node.body.body.push({
                            type: 'ReturnStatement'
                        });
                    }
                    fnBody = {
                        type: 'BlockStatement',
                        body: node.body.body.map(function (sub) {
                            return mapReturns(sub, path);
                        })
                    };
                } else {
                    fnBody = {
                        type: 'BlockStatement',
                        body: [mapReturns({
                            type: 'ReturnStatement',
                            argument: node.body
                        }, path)]
                    };
                    node.expression = false;
                }
                fnBody = {
                    type: 'CallExpression',
                    arguments: [{
                        type: 'ThisExpression'
                    }],
                    callee: {
                        type: 'MemberExpression',
                        object: setExit({
                            type: 'FunctionExpression',
                            params: [genIdent.return,genIdent.error],
                            body: fnBody,
                            $wasAsync: true
                        }, opts),
                        property: genIdent.asyncbind,
                        computed: false
                    }
                };
                if (opts.promises) {
                    fnBody = {
                        type: 'NewExpression',
                        callee: ident('Promise'),
                        arguments: [fnBody]
                    };
                } else {
                    if (!opts.lazyThenables)
                        fnBody.arguments.push(literal(true)) ;
                }
                fnBody = {
                    type: 'BlockStatement',
                    body: [{
                        type: 'ReturnStatement',
                        loc: node.loc,
                        argument: fnBody
                    }]
                };
                if (usesArgs)
                    afterDirectives(fnBody.body,[assign$Args]);
                node.body = fnBody;
                return;
            }
        });
        return ast;
    }

    /*
     * Rewrite
      async function <name>?<argumentlist><body>
    to
      function <name>?<argumentlist>{ return function*() {<body>}.$asyncspawn(); }
     */
    // Like mapReturns, but ONLY for return/throw async
    function mapAsyncReturns(ast) {
        if (Array.isArray(ast)) {
            return ast.map(mapAsyncReturns);
        }
        var lambdaNesting = 0;
        return parser.treeWalker(ast, function (node, descend, path) {
            if ((node.type === 'ThrowStatement' || node.type === 'ReturnStatement') && !node.$mapped) {
                if (lambdaNesting > 0) {
                    if (examine(node).isAsync) {
                        delete node.async;
                        node.argument = {
                            "type": "CallExpression",
                            "callee": node.type === 'ThrowStatement' ? genIdent.error : genIdent.return,
                                "arguments": node.argument ? [node.argument] : []
                        };
                        node.type = 'ReturnStatement';
                        return;
                    }
                }
            } else if (examine(node).isFunction) {
                lambdaNesting++;
                descend(node);
                lambdaNesting--;
                return;
            }
            descend(node);
        });
    }

    function spawnBody(body, deferExit) {
        return {
            "type": "BlockStatement",
            "body": [{
                "type": "ReturnStatement",
                "argument": {
                    "type": "CallExpression",
                    "callee": {
                        "type": "MemberExpression",
                        "object": {
                            "type": "FunctionExpression",
                            "id": null,
                            "generator": true,
                            "expression": false,
                            "params": [genIdent.return,genIdent.error],
                            "body": {
                                type: 'BlockStatement',
                                body: mapAsyncReturns(body).concat(deferExit ? [{
                                    type: 'ReturnStatement',
                                    argument: genIdent.return
                                }] : [])
                            }
                        },
                        "property": genIdent.asyncspawn,
                        "computed": false
                    },
                    "arguments": [ident('Promise'),{
                        type: 'ThisExpression'
                    }]
                }
            }]
        };
    }

    function warnAsyncGetter(id) {
        if (!id.$asyncgetwarninig) {
            id.$asyncgetwarninig = true;
            logger(where(id) + "'async get "+printNode(id)+"(){...}' is non-standard. See https://github.com/MatAtBread/nodent#differences-from-the-es7-specification");
        }
    }

    function asyncSpawn(ast,engine) {
        function mapAwaits(ast,hide) {
            parser.treeWalker(ast, function (node, descend, path) {
                if (node !== ast && examine(node).isFunction)
                    return;
                if (examine(node).isAwait) {
                    if (hide) {
                        node.$hidden = true;
                        descend();
                    } else {
                        delete node.operator;
                        node.delegate = false;
                        node.type = 'YieldExpression';
                        descend();
                    }
                } else
                    descend();
            });
        }

        function promiseTransform(ast) {
            var promises = opts.promises;
            opts.promises = true;
            asyncTransforms(ast, true);
            opts.promises = promises;
        }

        function expandArrows(fn) {
            if (fn.body.type !== 'BlockStatement') {
                fn.body = {
                    type: 'BlockStatement',
                    body: [{
                        type: 'ReturnStatement',
                        argument: fn.body
                    }]
                };
            }
            return fn;
        }

        function warnAsyncExit(exit, fn) {
            if (!fn.$asyncexitwarninig) {
                fn.$asyncexitwarninig = true;
                logger(where(exit) + "'async " + ({
                    ReturnStatement: 'return',
                    ThrowStatement: 'throw'
                })[exit.type] + "' not possible in "+(engine?'engine':'generator')+" mode. Using Promises for function at " + where(fn));
            }
        }

        parser.treeWalker(ast, function (node, descend, path) {
            descend();
            var fn, exit, usesArgs;
            if (examine(node).isAsync && examine(node).isFunction) {
                var member ;
                if ((member = getMemberFunction(path[0].parent))
                    && examine(member).isAsync && path[0].parent.kind === 'get')  {
                    warnAsyncGetter(path[0].parent.key) ;
                }
                if (exit = containsAsyncExit(node.body)) {
                    // Do the Promise transform
                    warnAsyncExit(exit, node.body);
                    promiseTransform(node);
                } else if (!engine) {
                    fn = node;
                    delete fn.async;
                    usesArgs = replaceArguments(fn);
                    mapAwaits(fn,false);
                    fn = expandArrows(fn);
                    fn.body = spawnBody(fn.body.body, exit);
                    if (usesArgs)
                        afterDirectives(fn.body.body,[assign$Args]);
                    if (fn.id && path[0].parent.type === 'ExpressionStatement') {
                        fn.type = 'FunctionDeclaration';
                        path[1].replace(fn);
                    } else {
                        path[0].replace(fn);
                    }
                } else if (path[0].parent.kind !== 'get')
                    mapAwaits(node,true) ;
            } else if ((fn = getMemberFunction(node)) && examine(fn).isAsync) {
                if (exit = containsAsyncExit(fn)) {
                    // Do the Promise transform
                    warnAsyncExit(exit, fn);
                    promiseTransform(node);
                } else if (!engine || node.kind==='get') {
                    if (engine) {
                        promiseTransform(node) ;
                    } else {
                        node.async = false;
                        usesArgs = replaceArguments(fn);
                        mapAwaits(fn,false);
                        coerce(fn, expandArrows(fn));
                        fn.body = spawnBody(fn.body.body, exit);
                    }
                    if (usesArgs)
                        afterDirectives(fn.body.body,[assign$Args]);
                }
            }
        });

        // Map (and warn) about any out-of-scope awaits that are being
        // mapped using Promises.
        var promises = opts.promises;
        opts.promises = true;
        blockifyArrows(ast);
        hoistDeclarations(ast);
        labelTryCatch(ast);
        asyncLoops(ast);
        mapLogicalOp(ast);
        mapCondOp(ast);
        walkDown(ast, [mapBlock,mapTryCatch,mapIfStmt,mapSwitch]);
        asyncAwait(ast, "warn");
        opts.promises = promises;
        return ast;
    }

    /* Find all nodes within this scope matching the specified function */
    function scopedNodes(ast, matching, flat) {
        var matches = [];
        parser.treeWalker(ast, function (node, descend, path) {
            if (node === ast)
                return descend();
            if (matching(node, path)) {
                matches.push([].concat(path));
                return;
            }
            if (flat || examine(node).isScope) {
                return;
            }
            descend();
        });
        return matches;
    }

    function extractVars(vars,kind) {
        var varDecls = [];
        var duplicates = {} ;
        vars = vars.filter(function(v){ return v[0].parent.type !== 'ExportNamedDeclaration'}) ;
        if (vars.length) {
            var definitions = {};
            vars.forEach(function (path) {
                function addName(name) {
                    if (name in definitions) {
                        duplicates[name] = self.declarations[i] ;
                    } else {
                        definitions[name] = self.declarations[i] ;
                    }
                }

                var ref = path[0];
                var self = ref.self;
                var kind = self.kind ;
                var values = [];
                for (var i = 0;i < self.declarations.length; i++) {
                    var decl = self.declarations[i] ;
                    getDeclNames(decl.id).forEach(addName) ;
                    if (decl.init) {
                        var value = {
                            type: 'AssignmentExpression',
                            left: cloneNode(decl.id),
                            operator: '=',
                            right: cloneNode(decl.init)
                        };
                        if (!(ref.parent.type === 'ForStatement')) {
                            value = {
                                type: 'ExpressionStatement',
                                expression: value
                            };
                        }
                        values.push(value);
                    }
                }
                if (values.length == 0)
                    ref.remove();
                else
                    ref.replace(values);
            });

            var defs = Object.keys(definitions) ;
            if (defs.length) {
                defs = defs.map(function (name) {
                    return {
                        type: 'VariableDeclarator',
                        id: ident(name),
                        loc: definitions[name].loc,
                        start: definitions[name].start,
                        end: definitions[name].end
                    };
                });
                if (!varDecls[0] || varDecls[0].type !== 'VariableDeclaration') {
                    varDecls.unshift({
                        type: 'VariableDeclaration',
                        kind: kind,
                        declarations: defs
                    });
                } else {
                    varDecls[0].declarations = varDecls[0].declarations.concat(defs);
                }
            }
        }
        return { decls: varDecls, duplicates: duplicates } ;
    }

    function getDeclNames(id) {
        if (!id) return [] ;
        if (Array.isArray(id)) {
            return id.reduce(function(z,j){ return z.concat(getDeclNames(j.id))},[]) ;
        }
        switch (id.type) {
        case 'Identifier':
            return [id.name]  ;
        case 'ArrayPattern':
            return id.elements.reduce(function(z,e){ return z.concat(getDeclNames(e)) },[]) ;
        case 'ObjectPattern':
            return id.properties.reduce(function(z,e){ return z.concat(getDeclNames(e)) },[]) ;
        case 'ObjectProperty':
        case 'Property':
            return getDeclNames(id.value) ;
        case 'RestElement':
        case 'RestProperty':
            return getDeclNames(id.argument) ;
        }
    }

    function checkConstsNotAssigned(ast) {
        /* Ensure no consts are on the LHS of an AssignmentExpression */
        var names = {} ;

        function fail(node){
            logger(where(node) + "Possible assignment to 'const " + printNode(node)+"'");
        }

        function checkAssignable(target) {
            switch (target.type) {
            case 'Identifier':
                // Find the declaration of any names on the left
                if (names[target.name] === 'const') fail(target) ;
                break ;
            case 'ArrayPattern':
                target.elements.forEach(function(e){
                    if (names[e.name] === 'const') fail(e) ;
                }) ;
                break ;
            case 'ObjectPattern':
                target.properties.forEach(function(p){
                    if (names[p.key.name] === 'const') fail(p) ;
                }) ;
                break ;
            }
        }

        parser.treeWalker(ast, function (node, descend, path) {
            var body = examine(node).isBlockStatement ;
            if (body) {
                names = Object.create(names) ;

                for (var h=0; h<body.length; h++) {
                    if (body[h].type === 'VariableDeclaration') {
                        for (var i=0; i<body[h].declarations.length; i++) {
                            getDeclNames(body[h].declarations[i].id).forEach(function(name){
                                names[name] = body[h].kind ;
                            }) ;
                        }
                    }
                }
            }
            descend() ;

            if (node.type === 'AssignmentExpression')
                checkAssignable(node.left) ;
            else if (node.type === 'UpdateExpression')
                checkAssignable(node.argument) ;
            if (body)
                names = Object.getPrototypeOf(names) ;
        });
    }

    /* Move directives, vars and named functions to the top of their scope iff. the scope contains an 'await' */
    function hoistDeclarations(ast) {
        function isFreeVariable(kinds) {
            return function(n, path) {
                if (!n.kind) n.kind = 'var';
                if (n.type === 'VariableDeclaration' && kinds.indexOf(n.kind)>=0) {
                    var p = path[0] ;
                    // Don't hoist the LHS of for (var/let/const _ of/in ... ; ;){}
                    if (p.field == "left" && (p.parent.type === 'ForInStatement' || p.parent.type === 'ForOfStatement'))
                        return false;

                    // Don't hoist the LHS of for (let/const _ = ... ; ;){}
                    if (p.field == "init" && p.parent.type === 'ForStatement' && (n.kind==="const" || n.kind==="let"))
                        return false;

                    return true;
                }
            }
        }

        function isHoistableFunction(n, path) {
            // YES: We're a named async function
            if (examine(n).isAsync && examine(n).isFunction && n.id)
                return true;
            // YES: We're a named function, but not a continuation
            if (examine(n).isFunction && n.id) {
                return !n.$continuation;
            }
            // No, we're not a hoistable function
            return false;
        }

        checkConstsNotAssigned(ast) ;

        var inStrictBody = false ;
        parser.treeWalker(ast, function (node, descend, path) {
            var prevScope = inStrictBody ;
            inStrictBody = inStrictBody || isStrict(node) ;

            if (examine(node).isBlockStatement) {
                var await = containsAwait(node) ;
                if (await) {
                    // For this scope/block, find all the hoistable functions, vars and directives
                    var isScope = !path[0].parent || examine(path[0].parent).isScope ;

                    /* 'const' is highly problematic. In early version of Chrome (Node 0.10, 4.x, 5.x) non-standard behaviour:
                     *
                     * Node             scope           multiple-decls
                     * v0.1x            function        SyntaxError
                     * v0.1x strict     SyntaxError     SyntaxError
                     * 4/5.x            function        SyntaxError
                     * 4/5.x strict     block           ok (SyntaxError on duplicate in block)
                     * 6.x  (as 4/5.x strict)
                     *
                     * To make these non-standard behaviours work, we treat a single declaration of a const identifier as requiring function scope (which works everywhere),
                     * declare as a 'var' and initialize inline.
                     * We treat multiple declarations as block-scoped, and let the engine work it out. To make consts blocked-scope, we use 'const' where possible (i.e. before
                     * any await expressions), or declare as 'let' after an await. This breaks in non-strict mode in Node 4/5, as 'let' requires strict mode.
                     *
                     * In summary, what this means is:
                     * - const's with a single declaration in the current scope (NOT block) should be hoisted to function level, and defined as 'var'
                     * - const's with duplicate declarations in the current scope (NOT block) should be hoisted to block level, and defined as 'let'
                     */

                    var directives, consts, vars, lets, functions ;
                    if (isScope) {
                        consts = scopedNodes(node, isFreeVariable(['const']),false);
                        var names = {}, duplicates = {} ;

                        // Work out which const identifiers are duplicates
                        // Ones that are only declared once can simply be treated as vars, whereas
                        // identifiers that are declared multiple times have block-scope and are
                        // only valid in node 6 or in strict mode on node 4/5
                        consts.forEach(function(d){
                            d[0].self.declarations.forEach(function(e){
                                getDeclNames(e.id).forEach(function(n){
                                    if (names[n] || duplicates[n]) {
                                        delete names[n] ;
                                        duplicates[n] = e ;
                                    } else {
                                        names[n] = e ;
                                    }
                                }) ;
                            }) ;
                        }) ;

                        // Change all the declarations into assignments, since consts are always initialized
                        consts.forEach(function(d){
                            for (var depth=0; depth<d.length; depth++)
                                if (examine(d[depth].parent).isBlockStatement)
                                    break ;

                            var ref = d[depth] ;
                            ref.append({
                                type: 'ExpressionStatement',
                                expression: {
                                    type: 'SequenceExpression',
                                    expressions: d[0].self.declarations.map(function (d) {
                                        var a = {
                                            type: 'AssignmentExpression',
                                            operator: '=',
                                            left: d.id,
                                            right: d.init
                                        };
                                        d.init = null ;
                                        return a ;
                                    })
                                }
                            });
                            var ids = getDeclNames(d[0].self.declarations) ;
                            var decls = ids.filter(function(name){ return name in duplicates }) ;
                            if (decls.length) {
                                d[0].append({
                                    type:'VariableDeclaration',
                                    kind:'let',
                                    declarations: decls.map(function(name){
                                        return {
                                            type:'VariableDeclarator',
                                            id:ident(name)
                                        }
                                    })
                                }) ;
                            }

                            d[0].self.kind = 'var' ;
                            decls = ids.filter(function(name){ return name in names }) ;
                            if (decls.length) {
                                d[0].self.declarations = decls.map(function(name){
                                    return {
                                        type:'VariableDeclarator',
                                        id:ident(name)
                                    }
                                });
                            } else {
                                ref.remove() ;
                            }
                        }) ;
                        vars = scopedNodes(node, isFreeVariable(['var']),false);
                        lets = [] ;
                    } else {
                        lets = scopedNodes(node, isFreeVariable(['const']),true);
                    }
                    lets = lets.concat(scopedNodes(node, isFreeVariable(['let']),true));
                    directives = scopedNodes(node, function (n) { return examine(n).isDirective },true);
                    functions = scopedNodes(node, isHoistableFunction, inStrictBody);

                    vars = vars?extractVars(vars,'var'):{duplicates:{},decls:[]} ;
                    lets = lets?extractVars(lets,'let'):{duplicates:{},decls:[]} ;

                    Object.keys(vars.duplicates).forEach(function(id){
                        logger(where(vars.duplicates[id]) + "Duplicate declaration '" + printNode(vars.duplicates[id]) + "'");
                    }) ;
                    Object.keys(lets.duplicates).forEach(function(id){
                        logger(where(lets.duplicates[id]) + "Duplicate declaration '" + printNode(lets.duplicates[id]) + "'");
                    }) ;

                    functions = functions.map(function (path) {
                        var ref = path[0], symName;
                        // What is the name of this function (could be async, so check the expression if necessary),
                        // and should we remove and hoist, or reference and hoist?
                        if (examine(ref.self).isAsync) {
                            symName = ref.self.id.name;
                            // If we're actually a top-level async FunctionExpression, redeclare as a FunctionDeclaration
                            if (examine(ref.parent).isBlockStatement) {
                                ref.self.type = 'FunctionDeclaration';
                                ref.remove();
                                return ref.self;
                            }
                            // We're an async FunctionExpression
                            return ref.replace(ident(symName));
                        }
                        // We're just a vanilla FunctionDeclaration or FunctionExpression
                        symName = ref.self.id.name;
                        var movedFn = ref.self.type === 'FunctionDeclaration' ? ref.remove() : ref.replace(ident(symName));
                        return movedFn;
                    });

                    directives = directives.map(function (path) {
                        var ref = path[0];
                        return ref.remove();
                    });
                    if (directives.length || vars.decls.length || lets.decls.length || functions.length) {
                        node.body = directives.concat(vars.decls).concat(lets.decls).concat(functions).concat(node.body);
                    }
                }
                inStrictBody = prevScope ;
            }
            descend();
            return true;
        });
        return ast;
    }

    function mapSupers(classNode) {
        function superID() {
            return classNode.$superID = classNode.$superID || ident("$super$" + generatedSymbol++);
        }

        return function (method) {
            method = getMemberFunction(method);
            if (method && examine(method).isAsync) {
                parser.treeWalker(method.body, function (node, descend, path) {
                    var r;
                    if (!examine(node).isClass) {
                        descend();
                        if (node.type === 'Super') {
                            if (path[0].parent.type === 'MemberExpression') {
                                if (path[1].parent.type === 'CallExpression' && path[1].field === 'callee') {
                                    if (path[0].parent.computed) {
                                        // super[m](...)  maps to:  this.$superid(m).call(this,...)
                                        r = {
                                            "type": "CallExpression",
                                            "callee": {
                                                "type": "MemberExpression",
                                                "object": {
                                                    "type": "CallExpression",
                                                    "callee": {
                                                        "type": "MemberExpression",
                                                        "object": {
                                                            "type": "ThisExpression"
                                                        },
                                                        "property": superID(),
                                                        "computed": false
                                                    },
                                                    "arguments": [path[0].parent.property]
                                                },
                                                "property": ident('call'),
                                                "computed": false
                                            },
                                            "arguments": [{
                                                "type": "ThisExpression"
                                            }].concat(path[1].parent.arguments)
                                        };
                                        path[2].replace(r);
                                    } else {
                                        // super.m(...)    maps to:  this.$superid('m').call(this,...)
                                        r = {
                                            "type": "CallExpression",
                                            "callee": {
                                                "type": "MemberExpression",
                                                "object": {
                                                    "type": "CallExpression",
                                                    "callee": {
                                                        "type": "MemberExpression",
                                                        "object": {
                                                            "type": "ThisExpression"
                                                        },
                                                        "property": superID(),
                                                        "computed": false
                                                    },
                                                    "arguments": [literal(path[0].parent.property.name)]
                                                },
                                                "property": ident('call'),
                                                "computed": false
                                            },
                                            "arguments": [{
                                                "type": "ThisExpression"
                                            }].concat(path[1].parent.arguments)
                                        };
                                        path[2].replace(r);
                                    }
                                } else {
                                    if (path[0].parent.computed) {
                                        // super[f],    maps to:  this.$superid(f)
                                        r = {
                                            "type": "CallExpression",
                                            "callee": {
                                                "type": "MemberExpression",
                                                "object": {
                                                    "type": "ThisExpression"
                                                },
                                                "property": superID(),
                                                "computed": false
                                            },
                                            "arguments": [path[0].parent.property]
                                        };
                                        path[1].replace(r);
                                    } else {
                                        // super.f,      maps to:  this.$superid('f')
                                        r = {
                                            "type": "CallExpression",
                                            "callee": {
                                                "type": "MemberExpression",
                                                "object": {
                                                    "type": "ThisExpression"
                                                },
                                                "property": superID(),
                                                "computed": false
                                            },
                                            "arguments": [literal(path[0].parent.property.name)]
                                        };
                                        path[1].replace(r);
                                    }
                                }
                            } else {
                                logger(where(node) + "'super' in async methods must be deferenced. 'async constructor()'/'await super()' not valid.");
                            }
                        }
                    }
                });
            }
        };
    }

    function fixSuperReferences(ast) {
        return parser.treeWalker(ast, function (node, descend, path) {
            descend();
            if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
                node.body.body.forEach(mapSupers(node));
                if (node.$superID) {
                    var method = {
                        "type": "FunctionExpression",
                        "params": [ident("$field")],
                        "body": {
                            "type": "BlockStatement",
                            "body": [{
                                "type": "ReturnStatement",
                                "argument": {
                                    "type": "MemberExpression",
                                    "object": {
                                        "type": "Super"
                                    },
                                    "property": ident("$field"),
                                    "computed": true
                                }
                            }]
                        }
                    };
                    if (opts.babelTree) {
                        method.type = 'ClassMethod';
                        method.key = node.$superID;
                        method.kind = 'method';
                        node.body.body.push(method);
                    } else {
                        node.body.body.push({
                            type: 'MethodDefinition',
                            key: node.$superID,
                            kind: 'method',
                            value: method
                        });
                    }
                }
            }
        });
    }

    function blockifyArrows(ast) {
        parser.treeWalker(ast, function (node, descend, path) {
            var awaiting = containsAwait(node);
            if (awaiting)  {
                if (node.type === 'ArrowFunctionExpression' && node.body.type !== 'BlockStatement') {
                    node.body = {
                        type: "BlockStatement",
                        body: [{
                            type: "ReturnStatement",
                            argument: node.body
                        }]
                    };
                }
            }
            descend();
            return true;
        });
        return ast;
    }

    function exposeCompilerOpts(ast) {
        // Expose compiler
        parser.treeWalker(ast, function (node, descend, path) {
            descend();
            if (node.type === 'Identifier' && node.name === '__nodent') {
                coerce(node, literal(opts));
            }
        });
        return ast;
    }

    /* Called with a Program or FunctionDeclaration.body */
    function isStrict(node) {
        if (node.type === 'Program' && node.sourceType === 'module')
            return true ;

        var nodes ;
        if (node.type === 'Program')
            nodes = node.body ;
        else if (examine(node).isFunction)
            nodes = node.body.body ;
        else return false ;

        if (nodes) for (var i=0; i<nodes.length; i++)
            if (examine(nodes[i]).isDirective && nodes[i].expression.value.match(/^\s*use\s+strict\s*$/))
                return true ;
        return false ;
    }

    function containsBlockScopedDeclarations(nodes) {
        for (var i = 0;i < nodes.length; i++) {
            var node = nodes[i];
            if (node.type === 'ClassDeclaration' ||
                (node.type === 'VariableDeclaration' && (node.kind === 'let' || node.kind === 'const')) ||
                (node.type === 'FunctionDeclaration' && node.id && node.id.name && !node.$continuation)) {
                return true;
            }
        }
        return false;
    }

    /* Remove un-necessary nested blocks and crunch down empty function implementations */
    function cleanCode(ast) {
        // Coalese BlockStatements
        parser.treeWalker(ast, function (node, descend, path) {
            descend();
            var block, child;
            // If this node is a block with vanilla BlockStatements (no controlling entity), merge them
            if (block = examine(node).isBlockStatement) {
                // Remove any empty statements from within the block
                // For ES6, this needs more care, as blocks containing 'let/const/class' have a scope of their own
                for (var i = 0;i < block.length; i++) {
                    if ((child = examine(block[i]).isBlockStatement) && !containsBlockScopedDeclarations(child)) {
                        if (!containsBlockScopedDeclarations(block[i]))
                            [].splice.apply(block, [i,1].concat(child));
                    }
                }
            }
        });
        // Truncate BlockStatements with a Jump (break;continue;return;throw) inside
        parser.treeWalker(ast, function (node, descend, path) {
            descend();
            if (examine(node).isJump) {
                var ref = path[0];
                if ('index' in ref) {
                    var i = ref.index + 1;
                    var ctn = ref.parent[ref.field];
                    while (i < ctn.length) {
                        // Remove any statements EXCEPT for function/var definitions
                        if (ctn[i].type === 'VariableDeclaration' || examine(ctn[i]).isFunction && ctn[i].id)
                            i += 1;
                        else
                            ctn.splice(i, 1);
                    }
                }
            }
        });
        /* Inline continuations that are only referenced once */
        // Find any continuations that have a single reference
        parser.treeWalker(ast, function (node, descend, path) {
            descend();
            if (node.$thisCall && continuations[node.name]) {
                if (continuations[node.name].ref) {
                    delete continuations[node.name]; //   Multiple ref
                } else {
                    continuations[node.name].ref = node.$thisCall;
                }
            }
        });
        var calls = Object.keys(continuations).map(function (c) {
            return continuations[c].ref;
        });
        if (calls.length) {
            // Replace all the calls to the continuation with the body from the continuation followed by 'return;'
            parser.treeWalker(ast, function (node, descend, path) {
                descend();
                if (calls.indexOf(node) >= 0) {
                    if (path[1].self.type === 'ReturnStatement') {
                        var sym = node.$thisCallName;
                        var repl = cloneNode(continuations[sym].def.body.body);
                        continuations[sym].$inlined = true;
                        if (!examine(path[1].self).isJump)
                            repl.push({
                                type: 'ReturnStatement'
                            });
                        path[1].replace(repl);
                    }
                }
            });
            var defs = Object.keys(continuations).map(function (c) {
                return continuations[c].$inlined && continuations[c].def;
            });
            // Remove all the (now inline) declarations of the continuations
            parser.treeWalker(ast, function (node, descend, path) {
                descend();
                if (defs.indexOf(node) >= 0) {
                    path[0].remove();
                }
            });
        }

        // Hoist generated FunctionDeclarations within ES5 Strict functions (actually put them at the
        // end of the scope-block, don't hoist them, it's just an expensive operation)
        var isModule = ast.type==='Program' || ast.sourceType==='module' ;
        if (!(isModule && contains(ast,function(n){
            return examine(n).isES6
        },true))) {
            var useStrict = isStrict(ast) ;
            (function(ast){
                parser.treeWalker(ast, function (node, descend, path) {
                    if (node.type==='Program' || node.type==='FunctionDeclaration' || node.type==='FunctionExpression') {
                        var wasStrict = useStrict ;
                        useStrict = useStrict || isStrict(node) ;
                        if (useStrict) {
                            descend();

                            var functionScope = node.type === 'Program' ? node : node.body ;
                            var functions = scopedNodes(functionScope,function(n,path){
                                if (n.type==='FunctionDeclaration') {
                                    return path[0].parent !== functionScope ;
                                }
                            }) ;

                            functions = functions.map(function (path) {
                                return path[0].remove() ;
                            });
                            [].push.apply(functionScope.body,functions) ;
                        } else {
                            descend();
                        }
                        useStrict = wasStrict ;
                    } else {
                        descend();
                    }
                }) ;
            })(ast);
        }
        return ast;

        /*
        function replaceSymbols(ast,from,to) {
            parser.treeWalker(ast,function(node,descend,path){
                descend() ;
                if (node.type=='Identifier' && node.name==from) {
                    node.name = to ;
                }
            }) ;
            return ast ;
        }

        // Find declarations of functions of the form:
        //     function [sym]() { return _call_.call(this) }
        // or
        //     function [sym]() { return _call_() }
        // and replace with:
        //    _call_
        // If the [sym] exists and is referenced elsewhere, replace those too. This
        // needs to be done recursively from the bottom of the tree upwards.
        // NB: If _call_ is in the parameter list for the function, this is NOT a correct optimization


        // The symbol folding above might generate lines like:
        //    $return.$asyncbind(this,$error)
        // these can be simplified to:
        //    $return
         */
        return ast;
    }
}

module.exports = {
    babelLiteralNode: babelLiteralNode,
    asynchronize: function (pr, __sourceMapping, opts, logger) {
        try {
            return asynchronize(pr, __sourceMapping, opts, logger);
        } catch (ex) {
            if (ex instanceof SyntaxError) {
                var l = pr.origCode.substr(ex.pos - ex.loc.column);
                l = l.split("\n")[0];
                ex.message += " (nodent)\n" + l + "\n" + l.replace(/[\S ]/g, "-").substring(0, ex.loc.column) + "^";
                ex.stack = "";
            }
            throw ex;
        }
    }
};
