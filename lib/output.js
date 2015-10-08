// This module is derived from Astring by David Bonnet (see below), but heavily
// modified to support source-maps & es7 as specified in 
// https://github.com/estree/estree/blob/master/experimental/async-functions.md

// --------------------
// Astring is a tiny and fast JavaScript code generator from an ESTree-compliant AST.
//
// Astring was written by David Bonnet and released under an MIT license.
//
// The Git repository for Astring is available at:
// https://github.com/davidbonnet/astring.git
//
// Please use the GitHub bug tracker to report issues:
// https://github.com/davidbonnet/astring/issues

var SourceMapGenerator = require('source-map').SourceMapGenerator;

function formatParameters(code, node, state, traveler) {
    var param, params;
    params = node.params;
    code.write(null, '(');
    if (params != null && params.length > 0) {
        traveler[params[0].type](params[0], state);
        for (var i = 1, length = params.length; i < length; i++) {
            param = params[i];
            code.write(param, ', ');
            traveler[param.type](param, state);
        }
    }
    code.write(null, ') ');
}
function formatExpression(code, node, operator, state, traveler, needed) {
    needed = needed || PARENTHESIS_NEEDED[node.type];
    if (needed === 0) {
        traveler[node.type](node, state);
        return;
    } else if (needed === 1) {
        if (OPERATORS_PRECEDENCE[node.operator] >= OPERATORS_PRECEDENCE[operator]) {
            traveler[node.type](node, state);
            return;
        }
    }
    code.write(null, '(');
    traveler[node.type](node, state);
    code.write(null, ')');
}

var ForInStatement, FunctionDeclaration, RestElement, BinaryExpression, ArrayExpression, traveler;

function repeat(str,count) {
    var out = [];
    while (count--) {
        out.push(str);
    }
    return out.join('');
}

var OPERATORS_PRECEDENCE = {
    '||': 3,
    '&&': 4,
    '|': 5,
    '^': 6,
    '&': 7,
    '==': 8,
    '!=': 8,
    '===': 8,
    '!==': 8,
    '<': 9,
    '>': 9,
    '<=': 9,
    '>=': 9,
    'in': 9,
    'instanceof': 9,
    '<<': 10,
    '>>': 10,
    '>>>': 10,
    '+': 11,
    '-': 11,
    '*': 12,
    '%': 12,
    '/': 12
};
var PARENTHESIS_NEEDED = {
    Identifier: 0,
    Literal: 0,
    MemberExpression: 0,
    CallExpression: 0,
    NewExpression: 0,
    Super: 0,
    ThisExpression: 0,
    UnaryExpression: 0,
    BinaryExpression: 1,
    LogicalExpression: 1
};
traveler = {
    Program: function (node, state) {
        var statements, statement;
        var indent = repeat(state.indent,state.indentLevel);
        var lineEnd = state.lineEnd, code = state.code;

        statements = node.body;
        for (var i = 0, length = statements.length; i < length; i++) {
            statement = statements[i];

            code.write(null, indent);
            this[statement.type](statement, state);
            code.write(null, lineEnd);
        }

    },
    BlockStatement: function (node, state) {
        var statements, statement;
        var indent = repeat(state.indent,state.indentLevel++);
        var lineEnd = state.lineEnd, code = state.code;
        var statementIndent = indent + state.indent;
        code.write(node, '{');
        statements = node.body;
        if (statements != null && statements.length > 0) {
            code.write(null, lineEnd);
            for (var i = 0, length = statements.length; i < length; i++) {
                statement = statements[i];

                code.write(null, statementIndent);
                this[statement.type](statement, state);
                code.write(null, lineEnd);
            }
            code.write(null, indent);
        }
        code.write(node.loc?{loc:{start:{line:node.loc.end.line,column:0}}}:null, '}');
        state.indentLevel--;
    },
    EmptyStatement: function (node, state) {
        state.code.write(node, ';');
    },
    ExpressionStatement: function (node, state) {
        this[node.expression.type](node.expression, state);
        state.code.write(null, ';');
    },
    IfStatement: function (node, state) {
        var code = state.code;
        code.write(node, 'if (');
        this[node.test.type](node.test, state);
        code.write(null, ') ');
        if (node.consequent.type !== 'BlockStatement')
        	code.write(null,state.lineEnd,repeat(state.indent,state.indentLevel+1)) ;
        this[node.consequent.type](node.consequent, state);
        if (node.alternate != null) {
            if (node.consequent.type !== 'BlockStatement')
            	code.write(null,state.lineEnd,repeat(state.indent,state.indentLevel)) ;
            code.write(null, ' else ');
            if (node.alternate.type !== 'BlockStatement' && node.alternate.type !== 'IfStatement')
            	code.write(null,state.lineEnd,repeat(state.indent,state.indentLevel+1)) ;
            this[node.alternate.type](node.alternate, state);
        }
    },
    LabeledStatement: function (node, state) {
        this[node.label.type](node.label, state);
        state.code.write(null, ':');
        this[node.body.type](node.body, state);
    },
    BreakStatement: function (node, state) {
        var code = state.code;
        code.write(node, 'break');
        if (node.label) {
            code.write(null, ' ');
            this[node.label.type](node.label, state);
        }
        code.write(null, ';');
    },
    ContinueStatement: function (node, state) {
        var code = state.code;
        code.write(node, 'continue');
        if (node.label) {
            code.write(null, ' ');
            this[node.label.type](node.label, state);
        }
        code.write(null, ';');
    },
    WithStatement: function (node, state) {
        var code = state.code;
        code.write(node, 'with (');
        this[node.object.type](node.object, state);
        code.write(null, ') ');
        this[node.body.type](node.body, state);
    },
    SwitchStatement: function (node, state) {
        var occurence, consequent, statement;
        var indent = repeat(state.indent,state.indentLevel++);
        var lineEnd = state.lineEnd, code = state.code;
        state.indentLevel++;
        var caseIndent = indent + state.indent;
        var statementIndent = caseIndent + state.indent;
        code.write(node, 'switch (');
        this[node.discriminant.type](node.discriminant, state);
        code.write(null, ') {', lineEnd);
        var occurences = node.cases;
        for (var i = 0; i < occurences.length; i++) {
            occurence = occurences[i];

            if (occurence.test) {
                code.write(occurence, caseIndent, 'case ');
                this[occurence.test.type](occurence.test, state);
                code.write(null, ':', lineEnd);
            } else {
                code.write(occurence, caseIndent, 'default:', lineEnd);
            }
            consequent = occurence.consequent;
            for (var j = 0; j < consequent.length; j++) {
                statement = consequent[j];

                code.write(null, statementIndent);
                this[statement.type](statement, state);
                code.write(null, lineEnd);
            }
        }
        state.indentLevel -= 2;
        code.write(null, indent, '}');
    },
    ReturnStatement: function (node, state) {
        var code = state.code;
        if (node.async)
            code.write(node, ' async ');
        code.write(node, 'return');
        if (node.argument) {
            code.write(null, ' ');
            this[node.argument.type](node.argument, state);
        }
        code.write(null, ';');
    },
    ThrowStatement: function (node, state) {
        var code = state.code;
        if (node.async)
            code.write(node, ' async ');
        code.write(node, 'throw ');
        this[node.argument.type](node.argument, state);
        code.write(null, ';');
    },
    TryStatement: function (node, state) {
        var handler;
        var code = state.code;
        code.write(node, 'try ');
        this[node.block.type](node.block, state);
        if (node.handler) {
            handler = node.handler;
            code.write(handler, ' catch (');
            this[handler.param.type](handler.param, state);
            code.write(null, ') ');
            this[handler.body.type](handler.body, state);
        }
        if (node.finalizer) {
            code.write(node.finalizer, ' finally ');
            this[node.finalizer.type](node.finalizer, state);
        }
    },
    WhileStatement: function (node, state) {
        var code = state.code;
        code.write(node, 'while (');
        this[node.test.type](node.test, state);
        code.write(null, ') ');
        if (node.body.type !== 'BlockStatement')
        	code.write(null,state.lineEnd,repeat(state.indent,state.indentLevel+1)) ;
        this[node.body.type](node.body, state);
    },
    DoWhileStatement: function (node, state) {
        var code = state.code;
        code.write(node, 'do ');
        if (node.body.type !== 'BlockStatement')
        	code.write(null,state.lineEnd,repeat(state.indent,state.indentLevel+1)) ;
        this[node.body.type](node.body, state);
        code.write(null, ' while (');
        this[node.test.type](node.test, state);
        code.write(null, ');');
    },
    ForStatement: function (node, state) {
        var code = state.code;
        code.write(node, 'for (');
        if (node.init != null) {
            var init = node.init, type = init.type;
            this[type](init, state);
            if (type[0] === 'V' && type.length === 19) {
                state.code.back();
            }
        }
        code.write(null, '; ');
        if (node.test) this[node.test.type](node.test, state);
        code.write(null, '; ');
        if (node.update) this[node.update.type](node.update, state);
        code.write(null, ') ');
        if (node.body.type !== 'BlockStatement')
        	code.write(null,state.lineEnd,repeat(state.indent,state.indentLevel+1)) ;
        this[node.body.type](node.body, state);
    },
    ForInStatement: ForInStatement = function (node, state) {
        var code = state.code;
        code.write(node, 'for (');
        var left = node.left, type = left.type;
        this[type](left, state);
        if (type[0] === 'V' && type.length === 19) {
            state.code.back();
        }
        code.write(null, node.type[3] === 'I' ? ' in ' : ' of ');
        this[node.right.type](node.right, state);
        code.write(null, ') ');
        if (node.body.type !== 'BlockStatement')
        	code.write(null,state.lineEnd,repeat(state.indent,state.indentLevel+1)) ;
        this[node.body.type](node.body, state);
    },
    ForOfStatement: ForInStatement,
    DebuggerStatement: function (node, state) {
        state.code.write(node, 'debugger;');
    },
    FunctionDeclaration: FunctionDeclaration = function (node, state) {
        var code = state.code;
        if (node.async)
        	code.write(node, 'async ') ;
        code.write(node, node.generator ? 'function* ' : 'function ');
        if (node.id) code.write(node.id, node.id.name);
        formatParameters(code, node, state, this);
        this[node.body.type](node.body, state);
        if (node.type==='FunctionDeclaration')
        	code.write(null,state.lineEnd,repeat(state.indent,state.indentLevel));
    },
    VariableDeclaration: function (node, state) {
        var code = state.code;
        var declarations = node.declarations;
        code.write(node, node.kind, ' ');
        var length = declarations.length;
        if (length > 0) {
            this['VariableDeclarator'](declarations[0], state);
            for (var i = 1; i < length; i++) {
                code.write(null, ', ');
                this['VariableDeclarator'](declarations[i], state);
            }
        }
        code.write(null, ';');
    },
    VariableDeclarator: function (node, state) {
        this[node.id.type](node.id, state);
        if (node.init != null) {
            state.code.write(null, ' = ');
            this[node.init.type](node.init, state);
        }
    },
    ClassDeclaration: function (node, state) {
        var code = state.code;
        code.write(node, 'class ');
        if (node.id) {
            code.write(node.id, node.id.name + ' ');
        }
        if (node.superClass) {
            code.write(null, 'extends ');
            this[node.superClass.type](node.superClass, state);
            code.write(null, ' ');
        }
        this['BlockStatement'](node.body, state);
    },
    ImportDeclaration: function (node, state) {
        var i, specifier, name;
        var code = state.code;
        code.write(node, 'import ');
        var specifiers = node.specifiers;
        var length = specifiers.length;
        if (length > 0) {
            i = 0;
            importSpecifiers: while (i < length) {
                specifier = specifiers[i];
                switch (specifier.type) {
                    case 'ImportDefaultSpecifier':
                        code.write(specifier, specifier.local.name);
                        i++;
                        break;
                    case 'ImportNamespaceSpecifier':
                        code.write(specifier, '* as ', specifier.local.name);
                        i++;
                        break;
                    default:
                        break importSpecifiers;
                }
                code.write(null, ', ');
            }
            if (i < length) {
                code.write(null, '{');
                while (i < length) {
                    specifier = specifiers[i];
                    name = specifier.name.imported;
                    code.write(specifier.name, name);
                    if (name !== specifier.local.name) {
                        code.write(specifier.local, ' as ', specifier.local.name);
                    }
                    code.write(null, ', ');
                    i++;
                }
                code.back();
                code.write(null, '}');
            } else {
                code.back();
            }
            code.write(null, ' from ');
        }
        code.write(node.source, node.source.raw);
        code.write(null, ';');
    },
    ExportDefaultDeclaration: function (node, state) {
        var code = state.code;
        code.write(node, 'export default ');
        this[node.declaration.type](node.declaration, state);
        if (node.declaration.type.substr(-10) === 'Expression') code.write(null, ';');
    },
    ExportNamedDeclaration: function (node, state) {
        var specifier, name;
        var code = state.code;
        code.write(node, 'export ');
        if (node.declaration) {
            this[node.declaration.type](node.declaration, state);
        } else {
            code.write(node, '{');
            var specifiers = node.specifiers, length = specifiers.length;
            if (length > 0) {
                for (var i = 0; ; ) {
                    specifier = specifiers[i];
                    name = specifier.name.local;
                    code.write(specifier, name);
                    if (name !== specifier.exported.name) code.write(specifier.exported, ' as ' + specifier.exported.name);
                    if ((++i) < length) code.write(null, ', '); else break;
                }
            }
            code.write(null, '}');
            if (node.source) {
                code.write(node.source, ' from ', node.source.raw);
            }
            code.write(null, ';');
        }
    },
    ExportAllDeclaration: function (node, state) {
        state.code.write(node, 'export * from ');
        state.code.write(node.source, node.source.raw, ';');
    },
    MethodDefinition: function (node, state) {
        var code = state.code;
        if (node.static) code.write(node, 'static ');
        if (node.async) code.write(node, 'async ');
        switch (node.kind) {
            case 'get':
            case 'set':
                code.write(node, node.kind, ' ');
                break;
            default:
                break;
        }
        if (node.computed) {
            code.write(null, '[');
            this[node.key.type](node.key, state);
            code.write(null, ']');
        } else {
            code.write(node.key, node.key.name);
        }
        formatParameters(code, node.value, state, this);
        this[node.value.body.type](node.value.body, state);
    },
    ClassExpression: function (node, state) {
        this['ClassDeclaration'](node, state);
    },
    ArrowFunctionExpression: function (node, state) {
        var code = state.code;
        if (node.async)
            code.write(node, 'async ');
        formatParameters(code, node, state, this);
        code.write(node, '=> ');
        if (node.body.type[0] === 'O') {
            code.write(null, '(');
            this['ObjectExpression'](node.body, state);
            code.write(null, ')');
        } else {
            this[node.body.type](node.body, state);
        }
    },
    ThisExpression: function (node, state) {
        state.code.write(node, 'this');
    },
    Super: function (node, state) {
        state.code.write(node, 'super');
    },
    RestElement: RestElement = function (node, state) {
        state.code.write(node, '...');
        this[node.argument.type](node.argument, state);
    },
    SpreadElement: RestElement,
    YieldExpression: function (node, state) {
        var code = state.code;
        code.write(node, 'yield');
        if (node.argument) {
            code.write(null, ' ');
            this[node.argument.type](node.argument, state);
        }
    },
    AwaitExpression: function (node, state) {
        var code = state.code;
        if (node.all)
            code.write(node, 'await* ');
        else
        	code.write(node, 'await ');
        this[node.argument.type](node.argument, state);
    },
    TemplateLiteral: function (node, state) {
        var expression;
        var code = state.code;
        var quasis = node.quasis, expressions = node.expressions;
        code.write(node, '`');
        for (var i = 0, length = expressions.length; i < length; i++) {
            expression = expressions[i];
            code.write(quasis[i].value, quasis[i].value.raw);
            code.write(null, '${');
            this[expression.type](expression, state);
            code.write(null, '}');
        }
        code.write(quasis[quasis.length - 1].value, quasis[quasis.length - 1].value.raw);
        code.write(node, '`');
    },
    TaggedTemplateExpression: function (node, state) {
        this[node.tag.type](node.tag, state);
        this[node.quasi.type](node.quasi, state);
    },
    ArrayExpression: ArrayExpression = function (node, state) {
        var element;
        var code = state.code;
        code.write(node, '[');
        if (node.elements.length > 0) {
            var elements = node.elements, length = elements.length;
            for (var i = 0; ; ) {
                element = elements[i];
                this[element.type](element, state);
                if ((++i) < length) 
                	code.write(null, ', '); 
                else 
                	break;
                if (code.lineLength()>state.wrapColumn)
                	code.write(null, state.lineEnd, repeat(state.indent,state.indentLevel+1)); 
            }
        }
        code.write(null, ']');
    },
    ArrayPattern: ArrayExpression,
    ObjectExpression: function (node, state) {
        var property;
        var indent = repeat(state.indent,state.indentLevel++);
        var lineEnd = state.lineEnd, code = state.code;
        var propertyIndent = indent + state.indent;
        code.write(node, '{');
        if (node.properties.length > 0) {
            code.write(null, lineEnd);

            var properties = node.properties, length = properties.length;
            for (var i = 0; ; ) {
                property = properties[i];

                code.write(null, propertyIndent);
                this['Property'](property, state);
                if ((++i) < length) 
                	code.write(node, ',', lineEnd); 
                else 
                	break;
                if (code.lineLength()>state.wrapColumn)
                	code.write(null, state.lineEnd, repeat(state.indent,state.indentLevel+1)); 
            }
            code.write(null, lineEnd, indent, '}');
        } else {
            code.write(null, '}');
        }
        state.indentLevel--;
    },
    Property: function (node, state) {
    	if (node.method || (node.kind=='get' || node.kind=='set')) {
    		this.MethodDefinition( node, state );
    	} else {
    		var code = state.code ;
    		if ( node.computed ) {
    			code.write(null, '[' )
    			this[ node.key.type ]( node.key, state )
    			code.write(null, ']' )
    		} else {
    			this[ node.key.type ]( node.key, state )
    		}
    		if ( !node.shorthand ) {
    			code.write(null, ': ' )
    			this[ node.value.type ]( node.value, state )
    		}
    	}
    },
    ObjectPattern: function (node, state) {
        var code = state.code;
        code.write(node, '{');
        if (node.properties.length > 0) {
            var properties = node.properties, length = properties.length;
            for (var i = 0; ; ) {
                this['Property'](properties[i], state);
                if ((++i) < length) code.write(null, ', '); else break;
            }
        }
        code.write(null, '}');
    },
    FunctionExpression: FunctionDeclaration,
    SequenceExpression: function (node, state) {
        var expression;
        var code = state.code;
        var expressions = node.expressions;
        if (expressions.length > 0) {
            var length = expressions.length;
            for (var i = 0; ; ) {
                expression = expressions[i];
                this[expression.type](expression, state);
                if ((++i) < length) code.write(null, ', '); else break;
            }
        }
    },
    UnaryExpression: function (node, state) {
        var code = state.code;
        if (node.prefix) {
            code.write(node, node.operator);
            if (PARENTHESIS_NEEDED[node.argument.type] === 1) {
                code.write(null, '(');
                this[node.argument.type](node.argument, state);
                code.write(null, ')');
            } else {
                if (node.operator.length > 1) state.code.write(null, ' ');
                this[node.argument.type](node.argument, state);
            }
        } else {
            this[node.argument.type](node.argument, state);
            state.code.write(node, node.operator);
        }
    },
    UpdateExpression: function (node, state) {
        if (node.prefix) {
            state.code.write(node, node.operator);
            this[node.argument.type](node.argument, state);
        } else {
            this[node.argument.type](node.argument, state);
            state.code.write(node, node.operator);
        }
    },
    AssignmentExpression: function (node, state) {
        this[node.left.type](node.left, state);
        state.code.write(node, ' ', node.operator, ' ');
        this[node.right.type](node.right, state);
    },
    AssignmentPattern: function (node, state) {
        this[node.left.type](node.left, state);
        state.code.write(node, ' = ');
        this[node.right.type](node.right, state);
    },
    BinaryExpression: BinaryExpression = function (node, state) {
        var code = state.code;
        var operator = node.operator;
        formatExpression(code, node.left, operator, state, this);
        code.write(node, ' ', node.operator, ' ');
        formatExpression(code, node.right, operator, state, this,
        		node.right.type==='BinaryExpression' &&
        		OPERATORS_PRECEDENCE[operator]>=OPERATORS_PRECEDENCE[node.right.operator]);
    },
    LogicalExpression: BinaryExpression,
    ConditionalExpression: function (node, state) {
        var code = state.code;
        this[node.test.type](node.test, state);
        code.write(node, ' ? ');
        this[node.consequent.type](node.consequent, state);
        code.write(null, ' : ');
        this[node.alternate.type](node.alternate, state);
    },
    NewExpression: function (node, state) {
        state.code.write(node, 'new ');
        this['CallExpression'](node, state);
    },
    CallExpression: function (node, state) {
        var arg;
        var code = state.code;
        if (PARENTHESIS_NEEDED[node.callee.type] === 0) {
            this[node.callee.type](node.callee, state);
        } else {
            code.write(null, '(');
            this[node.callee.type](node.callee, state);
            code.write(null, ')');
        }
        code.write(node, '(');
        var args = node['arguments'];
        if (args.length > 0) {
            this[args[0].type](args[0], state);
            var length = args.length;
            for (var i = 1; i < length; i++) {
                arg = args[i];
                code.write(null, ', ');
                this[arg.type](arg, state);
            }
        }
        code.write(null, ')');
    },
    MemberExpression: function (node, state) {
        var code = state.code;
        if (PARENTHESIS_NEEDED[node.object.type] === 0) {
            this[node.object.type](node.object, state);
        } else {
            code.write(null, '(');
            this[node.object.type](node.object, state);
            code.write(null, ')');
        }

        if (node.computed) {
            code.write(node, '[');
            this[node.property.type](node.property, state);
            code.write(null, ']');
        } else {
            code.write(node, '.');
            this[node.property.type](node.property, state);
        }
    },
    Identifier: function (node, state) {
        state.code.write(node, node.name);
    },
    Literal: function (node, state) {
        state.code.write(node, node.raw);
    }
};
module.exports = function (node, options) {
	options = options || {} ;
    var origLines, buffer = "", lines = [] ;
    var map = options.map && new SourceMapGenerator(options.map) ;

    if (map && options.map.sourceContent) {
    	map.setSourceContent(options.map.file, options.map.sourceContent) ;
    	origLines = options.map.sourceContent.split("\n") ;
    }

    var backBy = 0 ;
    var leadingComments = [] ;
    var trailingComments = [] ;

    var c = {
    	lineLength:function() {
    		return buffer.length ;
    	},
    	write:function(node) {
            var parts;
            parts = [].slice.call(arguments, 1);
            backBy = parts[parts.length-1].length ;
            for (var i = 0; i < parts.length; i++) {
            	if (map && node && node.loc && node.loc.start) {
                    var startOfLine = false ;//origLines[node.loc.start.line-1].substring(0,node.loc.start.column) ;
                    //startOfLine = startOfLine && startOfLine.match(/^\s*$/);
                    
                	map.addMapping({
                		source: options.map.file,
                		original: { line: node.loc.start.line, 
                			column: startOfLine?0:node.loc.start.column },
                		generated: { line: options.map.startLine + lines.length+1, 
                			column: startOfLine?0:buffer.length }
                	}) ;
                }
                if (parts[i] == state.lineEnd) {
                	if (trailingComments.length) {
                		trailingComments.forEach(function(c){
                			if (c.type==='Line')
                        		buffer += " // "+c.value ;
                			else {
                				(" /*"+c.value+"*/").split("\n").forEach(function(v){
                					buffer +=  v ;
                                	lines.push(buffer);
                                	buffer = "" ;
                				}) ;
                				buffer = lines.pop() ;
                			}
                		}) ;
                		trailingComments = [] ;
                	}
                	lines.push(buffer);
                	buffer = "" ;
                	if (leadingComments.length) {
                		var preceeding = lines.pop() ;
                		leadingComments.forEach(function(c){
                    		var indent = repeat(state.indent,c.indent) ;
                			if (c.type=="Line")
                				lines.push(indent+"//"+c.value) ;
                			else
	            				(indent+"/*"+c.value+"*/").split("\n").forEach(function(l){
	                				lines.push(l) ;
	            				}) ;
                		}) ;
                		lines.push(preceeding) ;
                		leadingComments = [] ;
                	}
                } else {
                	buffer += parts[i] ;
                	if (node && node.$comments) {
                		node.$comments.forEach(function(c) {
                			var trailing = node.loc.start.column < c.loc.start.column ;
                			c.indent = state.indentLevel ;
                			if (trailing){
                				trailingComments.push(c) ;
                			} else {
                    			leadingComments.push(c) ;
                			}
                		}) ;
                		node.$comments = null ;
                	}
                }
            }
        },
        back: function () {
        	buffer = buffer.substring(0,buffer.length-backBy) ;
        }
    };

    var state = {
        code: c,
        indent: "    ",
        lineEnd: "\n",
        indentLevel: 0,
        wrapColumn:80
    } ;
    traveler[node.type](node, state);
    trailingComments = node.$comments || [] ;
    state.code.write(node,state.lineEnd) ;
    var result = lines.join(state.lineEnd);
    if (options && options.map) {
    	return {code:result, map:map} ;
    }
    return result;
};
