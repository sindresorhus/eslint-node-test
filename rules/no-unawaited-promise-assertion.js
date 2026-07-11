import {findVariable, getStaticValue} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getHookCallback,
	getEffectiveArity,
	parseAssertionCall,
	getSubtestReceiver,
	getCalleeChain,
	isHookMemberTestCall,
	MODIFIERS,
} from './utils/node-test.js';
import {isFunction} from './ast/index.js';
import {getEnclosingFunction, unwrapTypeScriptExpression, isTypeScriptExpressionWrapper} from './utils/index.js';

const MESSAGE_ID = 'no-unawaited-promise-assertion';

const PROMISE_METHODS = new Set(['then', 'catch', 'finally']);
const PROMISE_ASSERTION_METHODS = new Set(['rejects', 'doesNotReject']);
const SCHEDULER_NAMES = new Set(['setTimeout', 'setImmediate', 'queueMicrotask']);
const TIMER_MODULES = new Set(['node:timers', 'timers']);
const NON_EXECUTABLE_STATEMENT_TYPES = new Set(['VariableDeclaration', 'FunctionDeclaration', 'EmptyStatement']);

const messages = {
	[MESSAGE_ID]: 'Assertion in a floating `{{method}}()` callback is not awaited by the test. Await or return the Promise chain.',
};

function unwrapChainExpression(node) {
	node = unwrapTypeScriptExpression(node);
	return node?.type === 'ChainExpression' ? node.expression : node;
}

function getFloatingExpression(node) {
	let expression = node;
	let {parent} = node;

	while (parent?.type === 'ChainExpression' || isTypeScriptExpressionWrapper(parent)) {
		expression = parent;
		parent = parent.parent;
	}

	if (parent?.type === 'UnaryExpression' && parent.operator === 'void') {
		const unaryExpression = parent;
		parent = parent.parent;

		if (parent?.type === 'ExpressionStatement') {
			return {
				expression: unaryExpression.argument,
				canFix: false,
			};
		}

		return undefined;
	}

	if (parent?.type !== 'ExpressionStatement') {
		return undefined;
	}

	return {
		expression,
		canFix: true,
	};
}

function getPromiseChainCalls(node) {
	const calls = [];
	node = unwrapChainExpression(node);

	while (node?.type === 'CallExpression') {
		const callee = unwrapChainExpression(node.callee);
		if (
			callee?.type !== 'MemberExpression'
			|| callee.computed
			|| callee.property.type !== 'Identifier'
		) {
			break;
		}

		if (!PROMISE_METHODS.has(callee.property.name)) {
			if (
				calls.length > 0
				&& unwrapChainExpression(callee.object)?.type === 'CallExpression'
			) {
				return [];
			}

			return calls;
		}

		calls.push({
			node,
			method: callee.property.name,
		});

		node = unwrapChainExpression(callee.object);
	}

	return calls;
}

function getPromiseCallbackArguments(call) {
	const {method} = call;
	const argumentIndexes = method === 'then' ? [0, 1] : [0];

	return argumentIndexes
		.map(index => unwrapTypeScriptExpression(call.node.arguments[index]))
		.filter(argument => argument && isFunction(argument));
}

function getContextParameter(callback) {
	const parameter = callback.params[0];
	return parameter?.type === 'Identifier' ? parameter : undefined;
}

function getContextAssertReceiver(node) {
	const {callee} = node;
	if (
		callee.type === 'MemberExpression'
		&& callee.object.type === 'MemberExpression'
		&& !callee.object.computed
		&& callee.object.object.type === 'Identifier'
		&& callee.object.property.type === 'Identifier'
		&& callee.object.property.name === 'assert'
	) {
		return callee.object.object;
	}

	return undefined;
}

function isTrackedContextAssertCall(node, contextParameters, sourceCode) {
	const receiver = getContextAssertReceiver(node);
	if (!receiver) {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(receiver), receiver);
	return variable?.identifiers.some(identifier => contextParameters.includes(identifier)) === true;
}

function isTrackedSubtestCall(node, contextParameters, sourceCode) {
	const receiver = getSubtestReceiver(node);
	if (!receiver) {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(receiver), receiver);
	return variable?.identifiers.some(identifier => contextParameters.includes(identifier)) === true;
}

function isImportBinding(identifier, sourceCode) {
	const variable = findVariable(sourceCode.getScope(identifier), identifier);
	return variable?.defs.some(definition => definition.type === 'ImportBinding') === true;
}

function isImportedTestCall(node, sourceCode) {
	const root = getCalleeChain(node.callee)?.root;
	return Boolean(root) && isImportBinding(root, sourceCode);
}

function hasOnlyTestModifiers(parsed) {
	return parsed.modifiers.every(modifier => MODIFIERS.has(modifier.name));
}

function getImportedAssertReference(node, imports) {
	const {callee} = node;

	if (
		callee.type === 'Identifier'
		&& (
			imports.assertNamed.has(callee.name)
			|| imports.assertNamespace.has(callee.name)
		)
	) {
		return callee;
	}

	if (
		callee.type === 'MemberExpression'
		&& callee.object.type === 'Identifier'
		&& imports.assertNamespace.has(callee.object.name)
	) {
		return callee.object;
	}

	return undefined;
}

function parseScopedAssertionCall(node, imports, contextParameters, sourceCode) {
	const parsed = parseAssertionCall(node, imports);
	if (!parsed) {
		return undefined;
	}

	if (getContextAssertReceiver(node)) {
		return isTrackedContextAssertCall(node, contextParameters, sourceCode) ? parsed : undefined;
	}

	const importedAssertReference = getImportedAssertReference(node, imports);
	return importedAssertReference && isImportBinding(importedAssertReference, sourceCode) ? parsed : undefined;
}

function isInsideHandledTryBlock(node, boundary) {
	let child = node;
	for (let {parent} = node; parent && child !== boundary; child = parent, parent = parent.parent) {
		if (
			parent.type === 'TryStatement'
			&& parent.block === child
			&& parent.handler
		) {
			return true;
		}
	}

	return false;
}

function findActivities(node, state) {
	const {
		imports,
		contextParameters,
		sourceCode,
		visitorKeys,
	} = state;

	node = unwrapTypeScriptExpression(node);
	if (!node) {
		return [];
	}

	if (isFunction(node)) {
		return [];
	}

	if (node.type === 'CallExpression') {
		const assertion = parseScopedAssertionCall(node, imports, contextParameters, sourceCode);
		if (
			assertion
			&& (
				PROMISE_ASSERTION_METHODS.has(assertion.method)
				|| !isInsideHandledTryBlock(node, state.boundary)
			)
		) {
			return [{node, type: 'Assertion'}];
		}
	}

	if (node.type === 'CallExpression' && isTrackedSubtestCall(node, contextParameters, sourceCode)) {
		return [{node, type: 'Subtest'}];
	}

	if (node.type === 'ThrowStatement' && !isInsideHandledTryBlock(node, state.boundary)) {
		return [{node, type: 'Throw'}];
	}

	const activities = [];
	for (const key of visitorKeys[node.type] ?? []) {
		const child = node[key];
		for (const childNode of Array.isArray(child) ? child : [child]) {
			if (childNode?.type) {
				activities.push(...findActivities(childNode, state));
			}
		}
	}

	return activities;
}

function getPromiseProblems(chainCalls, state, assertionOnly, messageId) {
	return chainCalls.flatMap(call => getPromiseCallbackArguments(call).flatMap(callback => {
		let activities = findActivities(callback.body, {...state, boundary: callback.body})
			.filter(activity => !assertionOnly || activity.type === 'Assertion');
		if (assertionOnly) {
			activities = activities.slice(0, 1);
		}

		return activities.map(activity => ({
			node: activity.node,
			messageId,
			data: {method: call.method, activity: activity.type, scheduler: `${call.method}()`},
		}));
	}));
}

function getTimerImports(sourceCode) {
	const named = new Map();
	const namespaces = new Set();

	for (const node of sourceCode.ast.body) {
		if (node.type !== 'ImportDeclaration' || !TIMER_MODULES.has(node.source.value)) {
			continue;
		}

		for (const specifier of node.specifiers) {
			if (
				specifier.type === 'ImportSpecifier'
				&& specifier.imported.type === 'Identifier'
				&& SCHEDULER_NAMES.has(specifier.imported.name)
			) {
				named.set(specifier.local.name, specifier.imported.name);
			} else if (specifier.type === 'ImportNamespaceSpecifier') {
				namespaces.add(specifier.local.name);
			}
		}
	}

	return {named, namespaces};
}

function getSchedulerName(node, timerImports, sourceCode) {
	const {callee} = node;
	if (callee.type === 'Identifier') {
		const variable = findVariable(sourceCode.getScope(callee), callee);
		if (SCHEDULER_NAMES.has(callee.name) && (!variable || variable.defs.length === 0)) {
			return callee.name;
		}

		if (timerImports.named.has(callee.name) && variable?.defs.some(definition => definition.type === 'ImportBinding')) {
			return timerImports.named.get(callee.name);
		}
	}

	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.object.type === 'Identifier'
		&& callee.property.type === 'Identifier'
		&& SCHEDULER_NAMES.has(callee.property.name)
		&& timerImports.namespaces.has(callee.object.name)
	) {
		const variable = findVariable(sourceCode.getScope(callee.object), callee.object);
		if (variable?.defs.some(definition => definition.type === 'ImportBinding')) {
			return callee.property.name;
		}
	}

	return undefined;
}

function getPromiseExpression(node, callback, sourceCode) {
	for (let current = node.parent; current && current !== callback; current = current.parent) {
		if (
			current.type === 'NewExpression'
			&& current.callee.type === 'Identifier'
			&& current.callee.name === 'Promise'
			&& (findVariable(sourceCode.getScope(current.callee), current.callee)?.defs.length ?? 0) === 0
		) {
			return current;
		}
	}

	return undefined;
}

function isExpressionConsumed(node) {
	while (node.parent) {
		const {parent} = node;
		if (
			parent.type === 'ChainExpression'
			|| isTypeScriptExpressionWrapper(parent)
			|| (parent.type === 'MemberExpression' && parent.object === node)
			|| (parent.type === 'CallExpression' && parent.callee === node)
		) {
			node = parent;
			continue;
		}

		break;
	}

	return node.parent?.type !== 'ExpressionStatement'
		&& !(node.parent?.type === 'UnaryExpression' && node.parent.operator === 'void');
}

function hasStaticallyTruthyWaitOption(node, sourceCode) {
	node = unwrapTypeScriptExpression(node);
	if (node?.type !== 'ObjectExpression') {
		return false;
	}

	for (let index = node.properties.length - 1; index >= 0; index -= 1) {
		const property = node.properties[index];
		if (property.type === 'SpreadElement') {
			return false;
		}

		if (
			property.type === 'Property'
			&& !property.computed
			&& (
				(property.key.type === 'Identifier' && property.key.name === 'wait')
				|| (property.key.type === 'Literal' && property.key.value === 'wait')
			)
		) {
			return Boolean(getStaticValue(property.value, sourceCode.getScope(property.value))?.value);
		}
	}

	return false;
}

function hasWaitPlan(callback, contextParameter, sourceCode) {
	if (!contextParameter || callback.body.type !== 'BlockStatement') {
		return false;
	}

	for (const statement of callback.body.body) {
		if (NON_EXECUTABLE_STATEMENT_TYPES.has(statement.type)) {
			continue;
		}

		const node = statement.type === 'ExpressionStatement' ? unwrapTypeScriptExpression(statement.expression) : undefined;
		if (
			node?.type === 'CallExpression'
			&& node.callee.type === 'MemberExpression'
			&& !node.callee.computed
			&& node.callee.object.type === 'Identifier'
			&& node.callee.property.type === 'Identifier'
			&& node.callee.property.name === 'plan'
			&& isSameVariable(node.callee.object, contextParameter, sourceCode)
		) {
			return hasStaticallyTruthyWaitOption(node.arguments[1], sourceCode);
		}

		return false;
	}

	return false;
}

function isSameVariable(identifier, declaration, sourceCode) {
	return findVariable(sourceCode.getScope(identifier), identifier)?.identifiers.includes(declaration) === true;
}

function getTestBoundaryCallback(node, imports, contextParameters, sourceCode) {
	const parsed = parseTestCall(node, imports);
	if (parsed) {
		const isHook = parsed.kind === 'hook' || isHookMemberTestCall(parsed);
		if (parsed.kind !== 'test' && !isHook) {
			return undefined;
		}

		if (!isHook && !hasOnlyTestModifiers(parsed)) {
			return undefined;
		}

		if (!isImportedTestCall(node, sourceCode)) {
			return undefined;
		}

		const callback = isHook ? getHookCallback(node) : getTestCallback(node);
		return callback && getEffectiveArity(callback.params) < 2 ? callback : undefined;
	}

	if (!isTrackedSubtestCall(node, contextParameters, sourceCode)) {
		return undefined;
	}

	const callback = getTestCallback(node);
	return callback && getEffectiveArity(callback.params) < 2 ? callback : undefined;
}

function hasStaticBlockBetween(node, boundary) {
	for (let current = node; current && current !== boundary; current = current.parent) {
		if (current.type === 'StaticBlock') {
			return true;
		}
	}

	return false;
}

export function trackDetachedCallbacks(context) {
	const imports = resolveImports(context);
	const {sourceCode} = context;
	const {visitorKeys} = sourceCode;
	const timerImports = getTimerImports(sourceCode);
	const detachedCallbacks = new WeakSet();
	const callbackStack = [];

	context.on('CallExpression', node => {
		const contextParameters = callbackStack.map(frame => frame.contextParameter).filter(Boolean);
		const boundaryCallback = getTestBoundaryCallback(node, imports, contextParameters, sourceCode);
		if (boundaryCallback) {
			const contextParameter = getContextParameter(boundaryCallback);
			callbackStack.push({
				node,
				callback: boundaryCallback,
				contextParameter,
				hasWaitPlan: hasWaitPlan(boundaryCallback, contextParameter, sourceCode),
			});
			return;
		}

		const activeFrame = callbackStack.at(-1);
		if (!activeFrame || activeFrame.hasWaitPlan) {
			return;
		}

		const scheduler = getSchedulerName(node, timerImports, sourceCode);
		const schedulerCallback = unwrapTypeScriptExpression(node.arguments[0]);
		const promiseExpression = getPromiseExpression(node, activeFrame.callback, sourceCode);
		const promiseExecutor = promiseExpression && unwrapTypeScriptExpression(promiseExpression.arguments[0]);
		const enclosingFunction = getEnclosingFunction(node);
		if (
			scheduler
			&& isFunction(schedulerCallback)
			&& (enclosingFunction === activeFrame.callback || enclosingFunction === promiseExecutor)
			&& !(promiseExpression && isExpressionConsumed(promiseExpression))) {
			detachedCallbacks.add(schedulerCallback);
		}

		const floatingExpression = getFloatingExpression(node);
		if (!floatingExpression || getEnclosingFunction(node) !== activeFrame.callback) {
			return;
		}

		for (const call of getPromiseChainCalls(floatingExpression.expression)) {
			for (const callback of getPromiseCallbackArguments(call)) {
				detachedCallbacks.add(callback);
			}
		}
	});

	context.onExit('CallExpression', node => {
		if (callbackStack.at(-1)?.node === node) {
			callbackStack.pop();
		}
	});

	return node => detachedCallbacks.has(getEnclosingFunction(node));
}

export function createLateTestActivity(context, {assertionsOnly = false, messageId = MESSAGE_ID} = {}) {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const {sourceCode} = context;
	const {visitorKeys} = sourceCode;
	const timerImports = getTimerImports(sourceCode);
	const callbackStack = [];

	context.on('CallExpression', node => {
		const contextParameters = callbackStack.map(frame => frame.contextParameter).filter(Boolean);
		const boundaryCallback = getTestBoundaryCallback(node, imports, contextParameters, sourceCode);

		if (boundaryCallback) {
			const contextParameter = getContextParameter(boundaryCallback);
			callbackStack.push({
				node,
				callback: boundaryCallback,
				contextParameter,
				hasWaitPlan: hasWaitPlan(boundaryCallback, contextParameter, sourceCode),
			});
			return;
		}

		const activeFrame = callbackStack.at(-1);
		const activeCallback = activeFrame?.callback;
		if (!activeCallback) {
			return;
		}

		if (!assertionsOnly) {
			if (activeFrame.hasWaitPlan) {
				return;
			}

			const scheduler = getSchedulerName(node, timerImports, sourceCode);
			const schedulerCallback = unwrapTypeScriptExpression(node.arguments[0]);
			const enclosingFunction = getEnclosingFunction(node);
			const promiseExpression = getPromiseExpression(node, activeCallback, sourceCode);
			const promiseExecutor = promiseExpression && unwrapTypeScriptExpression(promiseExpression.arguments[0]);
			if (
				scheduler
				&& schedulerCallback
				&& isFunction(schedulerCallback)
				&& (enclosingFunction === activeCallback || enclosingFunction === promiseExecutor)
				&& !(promiseExpression && isExpressionConsumed(promiseExpression))
			) {
				return findActivities(schedulerCallback.body, {
					imports,
					contextParameters,
					sourceCode,
					visitorKeys,
					boundary: schedulerCallback.body,
				}).map(activity => ({
					node: activity.node,
					messageId,
					data: {activity: activity.type, scheduler: `${scheduler}()`},
				}));
			}
		}

		if (getEnclosingFunction(node) !== activeCallback) {
			return;
		}

		const floatingExpression = getFloatingExpression(node);
		if (!floatingExpression) {
			return;
		}

		const chainCalls = getPromiseChainCalls(floatingExpression.expression);
		if (chainCalls.length === 0) {
			return;
		}

		const problems = getPromiseProblems(chainCalls, {
			imports,
			contextParameters,
			sourceCode,
			visitorKeys,
		}, assertionsOnly, messageId);
		if (problems.length === 0) {
			return;
		}

		if (
			floatingExpression.canFix
			&& activeCallback.async
			&& !hasStaticBlockBetween(floatingExpression.expression, activeCallback)
		) {
			problems[0].fix = fixer => fixer.insertTextBefore(floatingExpression.expression, 'await ');
		}

		return problems;
	});

	context.onExit('CallExpression', node => {
		if (callbackStack.at(-1)?.node === node) {
			callbackStack.pop();
		}
	});
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	createLateTestActivity(context, {assertionsOnly: true});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow assertions inside unawaited Promise callbacks.',
			recommended: false,
		},
		fixable: 'code',
		deprecated: {
			message: 'Use `no-late-test-activity` instead.',
			replacedBy: ['no-late-test-activity'],
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
