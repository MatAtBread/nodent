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
var ForInStatement, Function, RestElement, BinaryExpression, ArrayExpression, traveler;

function repeat(str,count) {
    var out = [];
    while (count--) {
        out.push(str);
    }
    return out.join('');
}

var OPERATORS_PRECEDENCE = {
		'ExpressionStatement':-1,// Use to parenthesize FunctionExpressions as statements
		'Identifier':20,
		'Literal':20,
		'ThisExpression':20,
		'SuperExpression':20,
		'Literal':20,
		'ObjectExpression':20,
		'ClassExpression':20,
//		'(_)':19,	// Parens
		'MemberExpression': 18,
//		'new()':18,
		'CallExpression': 17,
		'NewExpression': 17,

		'ArrayExpression':16.5,
		'FunctionExpression':16.5,
		'FunctionDeclaration':16.5,
		'ArrowFunctionExpression':16.5,
		
		'++':16, // Postfix
		'--':16, // Postfix
		'++':15, // Prefix
		'--':15, // Prefix
		'!':15,
		'~':15,
		'+':15,
		'-':15,
		'typeof':15,
		'void':15,
		'delete':15,
		'await':15,
		'AwaitExpression':15,
		'**':14,
		'*':14,
		'/':14,
		'%':14,
		'+':13,
		'-':13,
		'+':13,
		'<<':12,
		'>>':12,
		'>>>':12,
		'<':11,
		'<=':11,
		'>':11,
		'>=':11,
		'in':11,
		'instanceof':11,
		'==':10,
		'===':10,
		'!=':10,
		'!==':10,
		'&':9,
		'^':8,
		'|':7,
		'&&':6,
		'||':5,
		'ConditionalExpression':4,
		'AssignmentPattern':3,
		'=':3,
		'+=':3,
		'-=':3,
		'**=':3,
		'*=':3,
		'/=':3,
		'%=':3,
		'<<=':3,
		'>>=':3,
		'>>>=':3,
		'&=':3,
		'^=':3,
		'|=':3,
		'yield':2,
		'YieldExpression':2,
		'SpreadElement':1,
		'...':1,
		',':0,
		'SequenceExpression':0
};

function precedence(node){
	var p = OPERATORS_PRECEDENCE[node.operator || node.type] ;
	if (p!==undefined)
		return p ;
	//console.log("Precedence?",node.type,node.operator) ;
	return 20; 
}

traveler = {
	expr:function expr(state, parent, node) {
	    if (precedence(node) < precedence(parent) || (precedence(node) == precedence(parent) && parent.right===node)) {
	        state.write(null, '(');
	        this[node.type](node, state);
	        state.write(null, ')');
	    } else {
	        this[node.type](node, state);
	    }
	},

	formatParameters:function formatParameters(node, state) {
	    var param, params;
	    params = node.params;
	    state.write(null, '(');
	    if (params != null && params.length > 0) {
	        this[params[0].type](params[0], state);
	        for (var i = 1, length = params.length; i < length; i++) {
	            param = params[i];
	            state.write(param, ', ');
	            this[param.type](param, state);
	        }
	    }
	    state.write(null, ') ');
	},

    Program: function (node, state) {
        var statements, statement;
        var indent = repeat(state.indent,state.indentLevel);
        var lineEnd = state.lineEnd;

        statements = node.body;
        for (var i = 0, length = statements.length; i < length; i++) {
            statement = statements[i];

            state.write(null, indent);
            this[statement.type](statement, state);
            state.write(null, lineEnd);
        }

    },
    BlockStatement: function (node, state) {
        var statements, statement;
        var indent = repeat(state.indent,state.indentLevel++);
        var lineEnd = state.lineEnd;
        var statementIndent = indent + state.indent;
        state.write(node, '{');
        statements = node.body;
        if (statements != null && statements.length > 0) {
            state.write(null, lineEnd);
            for (var i = 0, length = statements.length; i < length; i++) {
                statement = statements[i];

                state.write(null, statementIndent);
                this[statement.type](statement, state);
                state.write(null, lineEnd);
            }
            state.write(null, indent);
        }
        state.write(node.loc?{loc:{start:{line:node.loc.end.line,column:0}}}:null, '}');
        state.indentLevel--;
    },
    EmptyStatement: function (node, state) {
        state.write(node, ';');
    },
    ExpressionStatement: function (node, state) {
    	if (node.expression.type==='FunctionExpression' || node.expression.type==='ObjectExpression') {
            state.write(null, '(');
        	this.expr(state, node, node.expression);
        	state.write(null, ')');
    	} else {
    		this.expr(state, node, node.expression);
    	}
        state.write(null, ';');
    },
    IfStatement: function (node, state) {
        state.write(node, 'if (');
        this[node.test.type](node.test, state);
        state.write(null, ') ');
        if (node.consequent.type !== 'BlockStatement')
        	state.write(null,state.lineEnd,repeat(state.indent,state.indentLevel+1)) ;
        this[node.consequent.type](node.consequent, state);
        if (node.alternate != null) {
            if (node.consequent.type !== 'BlockStatement')
            	state.write(null,state.lineEnd,repeat(state.indent,state.indentLevel)) ;
            state.write(null, ' else ');
            if (node.alternate.type !== 'BlockStatement' && node.alternate.type !== 'IfStatement')
            	state.write(null,state.lineEnd,repeat(state.indent,state.indentLevel+1)) ;
            this[node.alternate.type](node.alternate, state);
        }
    },
    LabeledStatement: function (node, state) {
        this[node.label.type](node.label, state);
        state.write(null, ':');
        this[node.body.type](node.body, state);
    },
    BreakStatement: function (node, state) {

        state.write(node, 'break');
        if (node.label) {
            state.write(null, ' ');
            this[node.label.type](node.label, state);
        }
        state.write(null, ';');
    },
    ContinueStatement: function (node, state) {

        state.write(node, 'continue');
        if (node.label) {
            state.write(null, ' ');
            this[node.label.type](node.label, state);
        }
        state.write(null, ';');
    },
    WithStatement: function (node, state) {

        state.write(node, 'with (');
        this[node.object.type](node.object, state);
        state.write(null, ') ');
        this[node.body.type](node.body, state);
    },
    SwitchStatement: function (node, state) {
        var occurence, consequent, statement;
        var indent = repeat(state.indent,state.indentLevel++);
        var lineEnd = state.lineEnd;
        state.indentLevel++;
        var caseIndent = indent + state.indent;
        var statementIndent = caseIndent + state.indent;
        state.write(node, 'switch (');
        this[node.discriminant.type](node.discriminant, state);
        state.write(null, ') {', lineEnd);
        var occurences = node.cases;
        for (var i = 0; i < occurences.length; i++) {
            occurence = occurences[i];

            if (occurence.test) {
                state.write(occurence, caseIndent, 'case ');
                this[occurence.test.type](occurence.test, state);
                state.write(null, ':', lineEnd);
            } else {
                state.write(occurence, caseIndent, 'default:', lineEnd);
            }
            consequent = occurence.consequent;
            for (var j = 0; j < consequent.length; j++) {
                statement = consequent[j];

                state.write(null, statementIndent);
                this[statement.type](statement, state);
                state.write(null, lineEnd);
            }
        }
        state.indentLevel -= 2;
        state.write(null, indent, '}');
    },
    ReturnStatement: function (node, state) {

        if (node.async)
            state.write(node, ' async ');
        state.write(node, 'return');
        if (node.argument) {
            state.write(null, ' ');
            this[node.argument.type](node.argument, state);
        }
        state.write(null, ';');
    },
    ThrowStatement: function (node, state) {

        if (node.async)
            state.write(node, ' async ');
        state.write(node, 'throw ');
        this[node.argument.type](node.argument, state);
        state.write(null, ';');
    },
    TryStatement: function (node, state) {
        var handler;

        state.write(node, 'try ');
        this[node.block.type](node.block, state);
        if (node.handler) {
            handler = node.handler;
            state.write(handler, ' catch (');
            this[handler.param.type](handler.param, state);
            state.write(null, ') ');
            this[handler.body.type](handler.body, state);
        }
        if (node.finalizer) {
            state.write(node.finalizer, ' finally ');
            this[node.finalizer.type](node.finalizer, state);
        }
    },
    WhileStatement: function (node, state) {

        state.write(node, 'while (');
        this[node.test.type](node.test, state);
        state.write(null, ') ');
        if (node.body.type !== 'BlockStatement')
        	state.write(null,state.lineEnd,repeat(state.indent,state.indentLevel+1)) ;
        this[node.body.type](node.body, state);
    },
    DoWhileStatement: function (node, state) {

        state.write(node, 'do ');
        if (node.body.type !== 'BlockStatement')
        	state.write(null,state.lineEnd,repeat(state.indent,state.indentLevel+1)) ;
        this[node.body.type](node.body, state);
        state.write(null, ' while (');
        this[node.test.type](node.test, state);
        state.write(null, ');');
    },
    ForStatement: function (node, state) {

        state.write(node, 'for (');
        if (node.init != null) {
            var init = node.init, type = init.type;
            this[type](init, state);
            if (type[0] === 'V' && type.length === 19) {
                state.back();
            }
        }
        state.write(null, '; ');
        if (node.test) this[node.test.type](node.test, state);
        state.write(null, '; ');
        if (node.update) this[node.update.type](node.update, state);
        state.write(null, ') ');
        if (node.body.type !== 'BlockStatement')
        	state.write(null,state.lineEnd,repeat(state.indent,state.indentLevel+1)) ;
        this[node.body.type](node.body, state);
    },
    ForInStatement: ForInStatement = function (node, state) {
        state.write(node, 'for (');
        var left = node.left, type = left.type;
        this[type](left, state);
        if (type[0] === 'V' && type.length === 19) {
            state.back();
        }
        state.write(null, node.type[3] === 'I' ? ' in ' : ' of ');
        this[node.right.type](node.right, state);
        state.write(null, ') ');
        if (node.body.type !== 'BlockStatement')
        	state.write(null,state.lineEnd,repeat(state.indent,state.indentLevel+1)) ;
        this[node.body.type](node.body, state);
    },
    ForOfStatement: ForInStatement,
    DebuggerStatement: function (node, state) {
        state.write(node, 'debugger;');
    },
    Function: Function = function (node, state) {

        if (node.async)
        	state.write(node, 'async ') ;
        state.write(node, node.generator ? 'function* ' : 'function ');
        if (node.id) state.write(node.id, node.id.name);
        this.formatParameters(node, state);
        this[node.body.type](node.body, state);
    },
    FunctionDeclaration: function (node, state) {
    	this.Function(node,state) ;
        state.write(null,state.lineEnd,repeat(state.indent,state.indentLevel));
    },
    FunctionExpression: function(node,state){
    	this.Function(node,state) ;
    },
    VariableDeclaration: function (node, state) {

        var declarations = node.declarations;
        state.write(node, node.kind, ' ');
        var length = declarations.length;
        if (length > 0) {
            this['VariableDeclarator'](declarations[0], state);
            for (var i = 1; i < length; i++) {
                state.write(null, ', ');
                this['VariableDeclarator'](declarations[i], state);
            }
        }
        state.write(null, ';');
    },
    VariableDeclarator: function (node, state) {
        this[node.id.type](node.id, state);
        if (node.init != null) {
            state.write(null, ' = ');
            this[node.init.type](node.init, state);
        }
    },
    ClassDeclaration: function (node, state) {

        state.write(node, 'class ');
        if (node.id) {
            state.write(node.id, node.id.name + ' ');
        }
        if (node.superClass) {
            state.write(null, 'extends ');
            this[node.superClass.type](node.superClass, state);
            state.write(null, ' ');
        }
        this['BlockStatement'](node.body, state);
    },
    ImportSpecifier:function(node,state){
    	if (node.local.name == node.imported.name) {
        	this[node.local.type](node.local, state) ;
    	} else {
    		this[node.imported.type](node.imported, state) ;
    		state.write(null,' as ');
        	this[node.local.type](node.local, state) ;
    	}
    },
    ImportDefaultSpecifier:function(node,state){
    	this[node.local.type](node.local, state) ;
    },
    ImportNamespaceSpecifier:function(node,state){
		state.write(null,'* as ');
    	this[node.local.type](node.local, state) ;
    },
    ImportDeclaration: function (node, state) {
        var i, specifier, name;

        state.write(node, 'import ');
        
        var specifiers = node.specifiers;
        var length = specifiers.length;
        var block = true ;
        if (length > 0) {
        	for (var i=0; i<length; i++) {
        		if (specifiers[i].type === 'ImportSpecifier' && block) {
        			block = false ;
                    state.write(null, '{');
        		}

        		this[specifiers[i].type](specifiers[i],state) ;
        		if (i<length-1)
        			state.write(null, ', ');
        	}
    		if (specifiers[length-1].type === 'ImportSpecifier')
    			state.write(null, '}');
            state.write(null, ' from ');
        }
        state.write(node.source, node.source.raw);
        state.write(null, ';');
    },
    ExportDefaultDeclaration: function (node, state) {

        state.write(node, 'export default ');
        this[node.declaration.type](node.declaration, state);
        if (node.declaration.type.substr(-10) === 'Expression') state.write(null, ';');
    },
    ExportSpecifier:function(node,state) {
    	if (node.local.name==node.exported.name) {
    		this[node.local.type](node.local, state) ;
    	} else {
    		this[node.local.type](node.local, state) ;
    		state.write(null,' as ');
    		this[node.exported.type](node.exported, state) ;
    	}
    },
    ExportNamedDeclaration: function (node, state) {
        var specifier, name;

        state.write(node, 'export ');
        if (node.declaration) {
            this[node.declaration.type](node.declaration, state);
        } else {
            var specifiers = node.specifiers ;
            state.write(node, '{');
            if (specifiers && specifiers.length > 0) {
            	for (var i=0; i<specifiers.length; i++) {
            		this[specifiers[i].type](specifiers[i],state) ;
            		if (i<specifiers.length-1)
            			state.write(null,', ')
            	}
            }
            state.write(null, '}');
            if (node.source) {
                state.write(node.source, ' from ', node.source.raw);
            }
            state.write(null, ';');
        }
    },
    ExportAllDeclaration: function (node, state) {
        state.write(node, 'export * from ');
        state.write(node.source, node.source.raw, ';');
    },
    MethodDefinition: function (node, state) {

        if (node.static) state.write(node, 'static ');
        if (node.async) state.write(node, 'async ');
        switch (node.kind) {
            case 'get':
            case 'set':
                state.write(node, node.kind, ' ');
                break;
            default:
                break;
        }
        if (node.computed) {
            state.write(null, '[');
            this[node.key.type](node.key, state);
            state.write(null, ']');
        } else {
            state.write(node.key, node.key.name);
        }
        this.formatParameters(node.value, state);
        this[node.value.body.type](node.value.body, state);
    },
    ClassExpression: function (node, state) {
        this['ClassDeclaration'](node, state);
    },
    ArrowFunctionExpression: function (node, state) {

        if (node.async)
            state.write(node, 'async ');
        this.formatParameters(node, state);
        state.write(node, '=> ');
        if (node.body.type[0] === 'O') {
            state.write(null, '(');
            this['ObjectExpression'](node.body, state);
            state.write(null, ')');
        } else {
            this[node.body.type](node.body, state);
        }
    },
    ThisExpression: function (node, state) {
        state.write(node, 'this');
    },
    Super: function (node, state) {
        state.write(node, 'super');
    },
    RestElement: RestElement = function (node, state) {
        state.write(node, '...');
        this[node.argument.type](node.argument, state);
    },
    SpreadElement: RestElement,
    YieldExpression: function (node, state) {

        state.write(node, 'yield');
        if (node.argument) {
            state.write(null, ' ');
            this.expr(state, node, node.argument);
        }
    },
    AwaitExpression: function (node, state) {

        if (node.all)
            state.write(node, 'await* ');
        else
        	state.write(node, 'await ');
        this.expr(state, node, node.argument);
    },
    TemplateLiteral: function (node, state) {
        var expression;

        var quasis = node.quasis, expressions = node.expressions;
        state.write(node, '`');
        for (var i = 0, length = expressions.length; i < length; i++) {
            expression = expressions[i];
            state.write(quasis[i].value, quasis[i].value.raw);
            state.write(null, '${');
            this[expression.type](expression, state);
            state.write(null, '}');
        }
        state.write(quasis[quasis.length - 1].value, quasis[quasis.length - 1].value.raw);
        state.write(node, '`');
    },
    TaggedTemplateExpression: function (node, state) {
        this[node.tag.type](node.tag, state);
        this[node.quasi.type](node.quasi, state);
    },
    ArrayExpression: ArrayExpression = function (node, state) {
        var element;

        state.write(node, '[');
        if (node.elements.length > 0) {
            var elements = node.elements, length = elements.length;
            for (var i = 0; ; ) {
                element = elements[i];
                this[element.type](element, state);
                if ((++i) < length) 
                	state.write(null, ', '); 
                else 
                	break;
                if (state.lineLength()>state.wrapColumn)
                	state.write(null, state.lineEnd, repeat(state.indent,state.indentLevel+1)); 
            }
        }
        state.write(null, ']');
    },
    ArrayPattern: ArrayExpression,
    ObjectExpression: function (node, state) {
        var property;
        var indent = repeat(state.indent,state.indentLevel++);
        var lineEnd = state.lineEnd;
        var propertyIndent = indent + state.indent;
        state.write(node, '{');
        if (node.properties.length > 0) {
            state.write(null, lineEnd);

            var properties = node.properties, length = properties.length;
            for (var i = 0; ; ) {
                property = properties[i];

                state.write(null, propertyIndent);
                this['Property'](property, state);
                if ((++i) < length) 
                	state.write(node, ',', lineEnd); 
                else 
                	break;
                if (state.lineLength()>state.wrapColumn)
                	state.write(null, state.lineEnd, repeat(state.indent,state.indentLevel+1)); 
            }
            state.write(null, lineEnd, indent, '}');
        } else {
            state.write(null, '}');
        }
        state.indentLevel--;
    },
    Property: function (node, state) {
    	if (node.method || (node.kind=='get' || node.kind=='set')) {
    		this.MethodDefinition( node, state );
    	} else {
    		if ( !node.shorthand ) {
        		if ( node.computed ) {
        			state.write(null, '[' )
        			this[ node.key.type ]( node.key, state )
        			state.write(null, ']' )
        		} else {
        			this[ node.key.type ]( node.key, state )
        		}
    			state.write(null, ': ' )
    		}
			this[ node.value.type ]( node.value, state )
    	}
    },
    ObjectPattern: function (node, state) {

        state.write(node, '{');
        if (node.properties.length > 0) {
            var properties = node.properties, length = properties.length;
            for (var i = 0; ; ) {
                this['Property'](properties[i], state);
                if ((++i) < length) state.write(null, ', '); else break;
            }
        }
        state.write(null, '}');
    },
    SequenceExpression: function (node, state) {
        var expression;

        var expressions = node.expressions;
        if (expressions.length > 0) {
            var length = expressions.length;
            for (var i = 0; ; ) {
                expression = expressions[i];
                this[expression.type](expression, state);
                if ((++i) < length) state.write(null, ', '); else break;
            }
        }
    },
    UnaryExpression: function (node, state) {

        if (node.prefix) {
            state.write(node, node.operator);
            if (node.operator.length>1)
            	state.write(node,' ');
            this.expr(state,node,node.argument) ;
        } else {
            this.expr(state,node,node.argument) ;
            state.write(node, node.operator);
        }
    },
    UpdateExpression: function (node, state) {
        if (node.prefix) {
            state.write(node, node.operator);
            this[node.argument.type](node.argument, state);
        } else {
            this[node.argument.type](node.argument, state);
            state.write(node, node.operator);
        }
    },
    BinaryExpression: BinaryExpression = function (node, state) {
        var operator = node.operator;
        this.expr(state, node, node.left);
        state.write(node, ' ', operator, ' ');
        this.expr(state, node, node.right);
    },
    LogicalExpression: BinaryExpression,
    AssignmentExpression: BinaryExpression,
    AssignmentPattern: function (node, state) {
        this.expr(state, node, node.left);
        state.write(node, ' = ');
        this.expr(state, node, node.right);
    }, 
    ConditionalExpression: function (node, state) {

        this.expr(state, node, node.test);
        state.write(node, ' ? ');
        this.expr(state, node, node.consequent);
        state.write(null, ' : ');
        this.expr(state, node, node.alternate);
    },
    NewExpression: function (node, state) {
        state.write(node, 'new ');
        this['CallExpression'](node, state);
    },
    CallExpression: function (node, state) {
        var arg;


        this.expr(state, node, node.callee) ;
        state.write(node, '(');
        var args = node['arguments'];
        if (args.length > 0) {
            this[args[0].type](args[0], state);
            var length = args.length;
            for (var i = 1; i < length; i++) {
                arg = args[i];
                state.write(null, ', ');
                this[arg.type](arg, state);
            }
        }
        state.write(null, ')');
    },
    MemberExpression: function (node, state) {
        var noParens = (node.object.type==='CallExpression') || (precedence(node) <= precedence(node.object)) ; 
        if (noParens) {
            this[node.object.type](node.object, state);
        } else {
            state.write(null, '(');
            this[node.object.type](node.object, state);
            state.write(null, ')');
        }

        if (node.computed) {
            state.write(node, '[');
            this[node.property.type](node.property, state);
            state.write(null, ']');
        } else {
            state.write(node, '.');
            this[node.property.type](node.property, state);
        }
    },
    Identifier: function (node, state) {
        state.write(node, node.name);
    },
    Literal: function (node, state) {
        state.write(node, node.raw);
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

    var st = {
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
                if (parts[i] == st.lineEnd) {
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
                    		var indent = repeat(st.indent,c.indent) ;
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
                			c.indent = st.indentLevel ;
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
        },
        indent: "    ",
        lineEnd: "\n",
        indentLevel: 0,
        wrapColumn:80
    };

    traveler[node.type](node, st);
    trailingComments = node.$comments || [] ;
    st.write(node,st.lineEnd) ;
    var result = lines.join(st.lineEnd);
    if (options && options.map) {
    	return {code:result, map:map} ;
    }
    return result;
};
