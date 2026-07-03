import {findVariable} from '@eslint-community/eslint-utils';
import isFunction from './ast/is-function.js';
import {
	resolveImports,
	parseTestCall,
	getSubtestReceiver,
	getTestCallback,
	MODIFIERS,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-process-env-mutation';

const messages = {
	[MESSAGE_ID]: 'Do not mutate `process.env` inside a test. Use a hook that restores the original value.',
};

const PROCESS_MODULES = new Set(['node:process', 'process']);

const OBJECT_MUTATORS = new Set([
	'assign',
	'defineProperties',
	'defineProperty',
]);

const REFLECT_MUTATORS = new Set([
	'deleteProperty',
	'defineProperty',
	'set',
]);

const unwrapExpression = node => {
	let unwrapped = node && unwrapTypeScriptExpression(node);
	while (unwrapped?.type === 'ChainExpression') {
		unwrapped = unwrapTypeScriptExpression(unwrapped.expression);
	}

	return unwrapped;
};

const getStaticPropertyName = node => {
	if (node.type === 'Identifier') {
		return node.name;
	}

	return getStaticExpressionPropertyName(node);
};

const getStaticExpressionPropertyName = node => {
	if (node.type === 'Literal' && (typeof node.value === 'string' || typeof node.value === 'number')) {
		return String(node.value);
	}

	if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
		return node.quasis[0].value.cooked;
	}
};

const getMemberPropertyName = node => {
	if (node.type !== 'MemberExpression') {
		return;
	}

	if (!node.computed && node.property.type === 'Identifier') {
		return node.property.name;
	}

	if (node.computed) {
		return getStaticExpressionPropertyName(unwrapExpression(node.property));
	}
};

const getImportSpecifierName = specifier => {
	if (specifier.imported.type === 'Identifier') {
		return specifier.imported.name;
	}

	if (typeof specifier.imported.value === 'string') {
		return specifier.imported.value;
	}
};

const isUnshadowedGlobal = (context, node, name) => {
	if (node.type !== 'Identifier' || node.name !== name) {
		return false;
	}

	const variable = findVariable(context.sourceCode.getScope(node), node);
	return !variable || variable.defs.length === 0;
};

const isImportBinding = (context, node, names) => {
	if (node.type !== 'Identifier' || !names.has(node.name)) {
		return false;
	}

	const variable = findVariable(context.sourceCode.getScope(node), node);
	return variable?.defs.some(definition => definition.type === 'ImportBinding') ?? false;
};

const getRootIdentifier = node => {
	node = unwrapExpression(node);
	if (node?.type === 'Identifier') {
		return node;
	}

	if (node?.type === 'MemberExpression') {
		return getRootIdentifier(node.object);
	}
};

const getNearestFunction = node => {
	let {parent} = node;
	while (parent && !isFunction(parent)) {
		parent = parent.parent;
	}

	return parent;
};

const collectProcessModuleBindings = context => {
	const processNames = new Set();
	const environmentNames = new Set();

	for (const node of context.sourceCode.ast.body) {
		if (node.type !== 'ImportDeclaration' || !PROCESS_MODULES.has(node.source.value)) {
			continue;
		}

		for (const specifier of node.specifiers) {
			if (specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportNamespaceSpecifier') {
				processNames.add(specifier.local.name);
			} else if (specifier.type === 'ImportSpecifier') {
				const importedName = getImportSpecifierName(specifier);
				if (importedName === 'default') {
					processNames.add(specifier.local.name);
				} else if (importedName === 'env') {
					environmentNames.add(specifier.local.name);
				}
			}
		}
	}

	return {processNames, environmentNames};
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const {processNames, environmentNames} = collectProcessModuleBindings(context);
	const {sourceCode} = context;
	const testStack = [];
	const trackedCalls = new Set();

	const isProcessObject = node => {
		node = unwrapExpression(node);
		return node?.type === 'Identifier'
			&& (
				isImportBinding(context, node, processNames)
				|| (node.name === 'process' && isUnshadowedGlobal(context, node, 'process'))
			);
	};

	const isEnvironmentDestructuringProperty = (property, localName) => {
		if (property.type !== 'Property' || property.computed || getStaticPropertyName(property.key) !== 'env') {
			return false;
		}

		const {value} = property;
		if (value.type === 'Identifier') {
			return value.name === localName;
		}

		return value.type === 'AssignmentPattern'
			&& value.left.type === 'Identifier'
			&& value.left.name === localName;
	};

	const isEnvironmentAlias = (node, seenVariables) => {
		if (node.type !== 'Identifier') {
			return false;
		}

		const variable = findVariable(sourceCode.getScope(node), node);
		if (!variable || seenVariables.has(variable)) {
			return false;
		}

		seenVariables.add(variable);

		const definition = variable.defs.length === 1 ? variable.defs[0] : undefined;
		const declarator = definition?.type === 'Variable' ? definition.node : undefined;
		if (!declarator?.init || declarator.parent?.kind !== 'const') {
			return false;
		}

		if (declarator.id.type === 'Identifier') {
			return isEnvironmentObject(declarator.init, seenVariables);
		}

		return declarator.id.type === 'ObjectPattern'
			&& isProcessObject(declarator.init)
			&& declarator.id.properties.some(property => isEnvironmentDestructuringProperty(property, node.name));
	};

	const isEnvironmentObject = (node, seenVariables = new Set()) => {
		node = unwrapExpression(node);
		if (!node) {
			return false;
		}

		if (node.type === 'Identifier') {
			return isImportBinding(context, node, environmentNames) || isEnvironmentAlias(node, seenVariables);
		}

		return node.type === 'MemberExpression'
			&& getMemberPropertyName(node) === 'env'
			&& isProcessObject(node.object);
	};

	const isEnvironmentMember = node => {
		node = unwrapExpression(node);
		return node?.type === 'MemberExpression' && isEnvironmentObject(node.object);
	};

	const getEnvironmentAssignmentTarget = node => {
		node = unwrapExpression(node);
		if (!node) {
			return;
		}

		if (node.type === 'MemberExpression' && (isEnvironmentObject(node) || isEnvironmentMember(node))) {
			return node;
		}

		if (node.type === 'AssignmentPattern') {
			return getEnvironmentAssignmentTarget(node.left);
		}

		if (node.type === 'RestElement') {
			return getEnvironmentAssignmentTarget(node.argument);
		}

		if (node.type === 'ArrayPattern') {
			for (const element of node.elements) {
				const target = getEnvironmentAssignmentTarget(element);
				if (target) {
					return target;
				}
			}

			return;
		}

		if (node.type === 'ObjectPattern') {
			for (const property of node.properties) {
				const target = getEnvironmentAssignmentTarget(property.type === 'Property' ? property.value : property.argument);
				if (target) {
					return target;
				}
			}
		}
	};

	const getContextVariable = callback => {
		const [parameter] = callback.params;
		if (parameter?.type !== 'Identifier') {
			return;
		}

		return findVariable(sourceCode.getScope(parameter), parameter);
	};

	const isTestImportCall = node => {
		const parsed = parseTestCall(node, imports);
		if (
			parsed?.kind !== 'test'
			|| parsed.modifiers.some(modifier => !MODIFIERS.has(modifier.name))
		) {
			return false;
		}

		const root = getRootIdentifier(node.callee);
		return root?.type === 'Identifier'
			&& (
				isImportBinding(context, root, imports.locals)
				|| (root.name === imports.namespace && isImportBinding(context, root, new Set([imports.namespace])))
			);
	};

	const isSubtestCall = node => {
		const receiver = getSubtestReceiver(node);
		if (!receiver) {
			return false;
		}

		const variable = findVariable(sourceCode.getScope(receiver), receiver);
		return testStack.some(test => test.contextVariable && test.contextVariable === variable);
	};

	const enterTestCall = node => {
		if (!isTestImportCall(node) && !isSubtestCall(node)) {
			return;
		}

		const callback = getTestCallback(node);
		if (!callback) {
			return;
		}

		testStack.push({
			callback,
			contextVariable: getContextVariable(callback),
		});
		trackedCalls.add(node);
	};

	const leaveTestCall = node => {
		if (!trackedCalls.has(node)) {
			return;
		}

		trackedCalls.delete(node);
		testStack.pop();
	};

	const isInsideTestCallback = node => {
		const test = testStack.at(-1);
		if (!test) {
			return false;
		}

		return getNearestFunction(node) === test.callback;
	};

	const getMutatingProcessEnvironmentTarget = node => {
		if (!isInsideTestCallback(node)) {
			return;
		}

		if (node.type === 'AssignmentExpression') {
			return getEnvironmentAssignmentTarget(node.left);
		}

		if (node.type === 'UpdateExpression') {
			if (isEnvironmentMember(node.argument)) {
				return unwrapExpression(node.argument);
			}

			return;
		}

		if (
			node.type === 'UnaryExpression'
			&& node.operator === 'delete'
			&& (isEnvironmentObject(node.argument) || isEnvironmentMember(node.argument))
		) {
			return unwrapExpression(node.argument);
		}
	};

	const getMutatingCallTarget = node => {
		if (!isInsideTestCallback(node)) {
			return;
		}

		const callee = unwrapExpression(node.callee);
		if (
			callee?.type !== 'MemberExpression'
			|| node.arguments.length === 0
			|| !isEnvironmentObject(node.arguments[0])
		) {
			return;
		}

		const method = getMemberPropertyName(callee);
		const object = unwrapExpression(callee.object);
		if (
			method
			&& (
				(OBJECT_MUTATORS.has(method) && isUnshadowedGlobal(context, object, 'Object'))
				|| (REFLECT_MUTATORS.has(method) && isUnshadowedGlobal(context, object, 'Reflect'))
			)
		) {
			return unwrapExpression(node.arguments[0]);
		}
	};

	const getMutatingLoopTarget = node => {
		if (!isInsideTestCallback(node)) {
			return;
		}

		return getEnvironmentAssignmentTarget(node.left);
	};

	context.on('CallExpression', node => {
		enterTestCall(node);

		const target = getMutatingCallTarget(node);
		if (!target) {
			return;
		}

		return {
			node: target,
			messageId: MESSAGE_ID,
		};
	});

	context.onExit('CallExpression', node => {
		leaveTestCall(node);
	});

	context.on('AssignmentExpression', node => {
		const target = getMutatingProcessEnvironmentTarget(node);
		if (!target) {
			return;
		}

		return {
			node: target,
			messageId: MESSAGE_ID,
		};
	});

	context.on('UpdateExpression', node => {
		const target = getMutatingProcessEnvironmentTarget(node);
		if (!target) {
			return;
		}

		return {
			node: target,
			messageId: MESSAGE_ID,
		};
	});

	context.on('UnaryExpression', node => {
		const target = getMutatingProcessEnvironmentTarget(node);
		if (!target) {
			return;
		}

		return {
			node: target,
			messageId: MESSAGE_ID,
		};
	});

	context.on('ForInStatement', node => {
		const target = getMutatingLoopTarget(node);
		if (!target) {
			return;
		}

		return {
			node: target,
			messageId: MESSAGE_ID,
		};
	});

	context.on('ForOfStatement', node => {
		const target = getMutatingLoopTarget(node);
		if (!target) {
			return;
		}

		return {
			node: target,
			messageId: MESSAGE_ID,
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow mutating `process.env` inside tests.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
