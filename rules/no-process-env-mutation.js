import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getOutOfLineCallbackCall,
	getRegistrationKind,
	getContextVariable,
	hasOnlyKnownModifiers,
	getImportSpecifierName,
} from './utils/node-test.js';
import {
	unwrapExpression,
	getEnclosingFunction,
	isGlobalThisMember,
	isUnshadowedGlobal,
	isImportBinding,
	getStaticPropertyName,
} from './utils/index.js';
import {functionTypes} from './ast/index.js';

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

const isImportedName = (context, node, names) => node.type === 'Identifier'
	&& names.has(node.name)
	&& isImportBinding(node, context);

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
		// `globalThis.process` and `global.process` on the real global are the same object as `process`.
		if (isGlobalThisMember(node, 'process', context)) {
			return true;
		}

		return node?.type === 'Identifier'
			&& (
				isImportedName(context, node, processNames)
				|| (node.name === 'process' && isUnshadowedGlobal(node, 'process', context))
			);
	};

	const isEnvironmentDestructuringProperty = (property, localName) => {
		if (property.type !== 'Property' || getStaticPropertyName(property) !== 'env') {
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
			return isImportedName(context, node, environmentNames) || isEnvironmentAlias(node, seenVariables);
		}

		// `process.env` is a truthy object that is never nullish, so a defensive `process.env ?? {}` or `process.env || {}` still evaluates to `process.env`.
		if (node.type === 'LogicalExpression' && (node.operator === '??' || node.operator === '||')) {
			return isEnvironmentObject(node.left, seenVariables);
		}

		return node.type === 'MemberExpression'
			&& getStaticPropertyName(node) === 'env'
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

	// `parseTestCall` already requires the callee to start at a `node:test` import, so a standalone `only(…)`, `skip(…)` or `todo(…)` import counts too.
	const isTestImportCall = node => {
		const parsed = parseTestCall(node, imports);
		return parsed?.kind === 'test' && hasOnlyKnownModifiers(parsed);
	};

	// A subtest is read the way the out-of-line path below reads it, so one registered from a hook (`t.test(…)` on the hook's context, or `getTestContext().test(…)`) counts as well.
	const isSubtestCall = node => parseTestCall(node, imports) === undefined
		&& getRegistrationKind(node, imports, context) === 'test';

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
			contextVariable: getContextVariable(callback, context),
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

	// A test body the call names out of line is entered where it is declared, which the call's own frame does not cover, so a mutation in it sat outside every tracked scope.
	const outOfLineTestBodies = new WeakSet();

	const enterOutOfLineTestBody = node => {
		const call = getOutOfLineCallbackCall(node, context, imports);
		if (!call) {
			return;
		}

		// The kind comes from the shared classifier, so a subtest counts as a test too. Only an imported call has modifiers to check, which a subtest never does.
		const parsed = parseTestCall(call, imports);
		if (getRegistrationKind(call, imports, context) !== 'test' || (parsed && !hasOnlyKnownModifiers(parsed))) {
			return;
		}

		outOfLineTestBodies.add(node);
		testStack.push({callback: node, contextVariable: getContextVariable(node, context)});
	};

	const leaveOutOfLineTestBody = node => {
		if (outOfLineTestBodies.delete(node)) {
			testStack.pop();
		}
	};

	// Any test or subtest callback on the stack, not only the innermost one: a subtest's options object is evaluated inside the parent test's callback, so a mutation there is in a test body too.
	const isInsideTestCallback = node => {
		const enclosingFunction = getEnclosingFunction(node);
		return enclosingFunction !== undefined && testStack.some(test => test.callback === enclosingFunction);
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

		const method = getStaticPropertyName(callee);
		const object = unwrapExpression(callee.object);
		if (
			method
			&& (
				(OBJECT_MUTATORS.has(method) && isUnshadowedGlobal(object, 'Object', context))
				|| (REFLECT_MUTATORS.has(method) && isUnshadowedGlobal(object, 'Reflect', context))
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

	context.on(functionTypes, enterOutOfLineTestBody);
	context.onExit(functionTypes, leaveOutOfLineTestBody);

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
