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
import {
	getEnclosingFunction,
	unwrapTypeScriptExpression,
	unwrapExpression,
	skipExpressionWrappers,
	outermostExpressionWrapper,
	isExpressionWrapper,
} from './utils/index.js';

const MESSAGE_ID = 'no-unawaited-promise-assertion';

const PROMISE_METHODS = new Set(['then', 'catch', 'finally']);
const REJECTION_HANDLER_INDEXES = new Map([['then', 1], ['catch', 0]]);
const PROMISE_ASSERTION_METHODS = new Set(['rejects', 'doesNotReject']);
const SCHEDULER_NAMES = new Set(['setTimeout', 'setImmediate', 'queueMicrotask']);
const TIMER_MODULES = new Set(['node:timers', 'timers']);
const WAIT_PLAN_PREFIX_STATEMENT_TYPES = new Set(['VariableDeclaration', 'FunctionDeclaration', 'EmptyStatement']);

const messages = {
	[MESSAGE_ID]: 'Assertion in a floating `{{method}}()` callback is not awaited by the test. Await or return the Promise chain.',
};

function getExpressionValuePropagation(parent, child) {
	if (parent?.type === 'SequenceExpression') {
		return parent.expressions.at(-1) === child;
	}

	if (parent?.type === 'LogicalExpression') {
		return parent.right === child;
	}

	if (parent?.type === 'ConditionalExpression') {
		return parent.test !== child;
	}

	return undefined;
}

function getFloatingExpression(node) {
	const expression = outermostExpressionWrapper(node);

	let container = expression;
	let {parent} = expression;
	let valuePropagates;
	while ((valuePropagates = getExpressionValuePropagation(parent, container)) !== undefined) {
		if (!valuePropagates) {
			return {expression, canFix: false};
		}

		container = outermostExpressionWrapper(parent);
		parent = container.parent;
	}

	if (parent?.type === 'UnaryExpression' && parent.operator === 'void') {
		return {expression, canFix: false};
	}

	if (
		parent?.type === 'ForStatement'
		&& (parent.init === container || parent.update === container)
	) {
		return {expression, canFix: false};
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
	node = unwrapExpression(node);

	while (node?.type === 'CallExpression') {
		const callee = unwrapExpression(node.callee);
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
				&& unwrapExpression(callee.object)?.type === 'CallExpression'
			) {
				return [];
			}

			return calls;
		}

		calls.push({
			node,
			method: callee.property.name,
		});

		node = unwrapExpression(callee.object);
	}

	return calls;
}

function isInlineCallback(node) {
	return Boolean(node) && isFunction(node);
}

function getPromiseCallbackArguments(call) {
	const {method} = call;
	const argumentIndexes = method === 'then' ? [0, 1] : [0];

	return argumentIndexes
		.map(index => unwrapTypeScriptExpression(call.node.arguments[index]))
		.filter(argument => isInlineCallback(argument));
}

function getContextParameter(callback) {
	const parameter = callback.params[0];
	if (parameter?.type === 'Identifier') {
		return parameter;
	}

	return parameter?.type === 'AssignmentPattern' && parameter.left.type === 'Identifier' ? parameter.left : undefined;
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

function unwrapAssertionCallee(node) {
	node = unwrapExpression(node);
	if (node?.type !== 'MemberExpression') {
		return node;
	}

	const object = unwrapAssertionCallee(node.object);
	return object === node.object ? node : {...node, object};
}

function getUnwrappedAssertionCall(node) {
	const callee = unwrapAssertionCallee(node.callee);
	return callee === node.callee ? node : {...node, callee};
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
	let {callee} = node;
	while (callee.type === 'MemberExpression') {
		callee = callee.object;
	}

	if (
		callee.type === 'Identifier'
		&& (
			imports.assertNamed.has(callee.name)
			|| imports.assertNamespace.has(callee.name)
		)
	) {
		return callee;
	}

	return undefined;
}

function parseScopedAssertionCall(node, imports, contextParameters, sourceCode) {
	const assertionCall = getUnwrappedAssertionCall(node);
	const parsed = parseAssertionCall(assertionCall, imports);
	if (!parsed) {
		return undefined;
	}

	if (getContextAssertReceiver(assertionCall)) {
		return isTrackedContextAssertCall(assertionCall, contextParameters, sourceCode) ? parsed : undefined;
	}

	const importedAssertReference = getImportedAssertReference(assertionCall, imports);
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

function isAwaited(node) {
	return skipExpressionWrappers(node.parent)?.type === 'AwaitExpression';
}

function hasRejectionHandler(call) {
	const index = REJECTION_HANDLER_INDEXES.get(call.method);
	const argument = index === undefined ? undefined : unwrapTypeScriptExpression(call.node.arguments[index]);
	return isInlineCallback(argument)
		|| (
			argument?.type === 'Identifier'
			&& argument.name !== 'undefined'
		)
		|| argument?.type === 'MemberExpression'
		|| argument?.type === 'CallExpression';
}

function hasChainedRejectionHandler(node, boundary) {
	let current = node;
	while (current.parent && current !== boundary) {
		const {parent} = current;
		if (isExpressionWrapper(parent)) {
			current = parent;
			continue;
		}

		if (
			parent.type === 'MemberExpression'
			&& parent.object === current
			&& parent.parent?.type === 'CallExpression'
			&& parent.parent.callee === parent
			&& !parent.computed
			&& parent.property.type === 'Identifier'
			&& PROMISE_METHODS.has(parent.property.name)
		) {
			const call = {node: parent.parent, method: parent.property.name};
			if (hasRejectionHandler(call)) {
				return true;
			}

			current = parent.parent;
			continue;
		}

		break;
	}

	return false;
}

function getAssertionActivity(node, state) {
	const {imports, contextParameters, sourceCode} = state;
	const assertion = parseScopedAssertionCall(node, imports, contextParameters, sourceCode);
	if (!assertion) {
		return undefined;
	}

	const isPromiseAssertion = PROMISE_ASSERTION_METHODS.has(assertion.method);
	const isInsideHandledTry = isInsideHandledTryBlock(node, state.boundary);
	const isHandledPromiseAssertion = isPromiseAssertion
		&& (
			(!state.assertionsOnly && hasChainedRejectionHandler(node, state.boundary))
			|| (isAwaited(node) && isInsideHandledTry)
		);
	if (isHandledPromiseAssertion || (!isPromiseAssertion && isInsideHandledTry)) {
		return undefined;
	}

	return {node, type: 'Assertion'};
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

	const activities = [];

	if (node.type === 'CallExpression') {
		const assertionActivity = getAssertionActivity(node, state);
		if (assertionActivity) {
			activities.push(assertionActivity);
		}
	}

	if (node.type === 'CallExpression' && isTrackedSubtestCall(node, contextParameters, sourceCode)) {
		activities.push({node, type: 'Subtest'});
	}

	if (node.type === 'ThrowStatement' && !isInsideHandledTryBlock(node, state.boundary)) {
		activities.push({node, type: 'Throw'});
	}

	for (const key of visitorKeys[node.type] ?? []) {
		if (key === 'value' && isDeferredClassField(node)) {
			continue;
		}

		const child = node[key];
		for (const childNode of Array.isArray(child) ? child : [child]) {
			if (childNode?.type) {
				activities.push(...findActivities(childNode, state));
			}
		}
	}

	return activities;
}

function findCallbackActivities(callback, state) {
	return [
		...callback.params.flatMap(parameter => findActivities(parameter, {...state, boundary: parameter})),
		...(callback.generator ? [] : findActivities(callback.body, {...state, boundary: callback.body})),
	];
}

function isDeferredClassField(node) {
	return (node.type === 'PropertyDefinition' || node.type === 'AccessorProperty') && !node.static;
}

function getPromiseProblems(chainCalls, state, assertionsOnly, messageId) {
	return chainCalls.flatMap((call, index) => getPromiseCallbackArguments(call).flatMap(callback => {
		let activities = findCallbackActivities(callback, {...state, assertionsOnly})
			.filter(activity => assertionsOnly ? activity.type === 'Assertion' : activity.type !== 'Assertion');
		const hasDownstreamRejectionHandler = chainCalls.slice(0, index).some(outerCall => hasRejectionHandler(outerCall));
		if (!assertionsOnly && hasDownstreamRejectionHandler) {
			activities = activities.filter(activity => activity.type === 'Subtest');
		}

		if (assertionsOnly) {
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
	const callee = unwrapExpression(node.callee);
	if (callee.type === 'Identifier') {
		const variable = findVariable(sourceCode.getScope(callee), callee);
		if (SCHEDULER_NAMES.has(callee.name) && (!variable || variable.defs.length === 0)) {
			return callee.name;
		}

		if (timerImports.named.has(callee.name) && isImportBinding(callee, sourceCode)) {
			return timerImports.named.get(callee.name);
		}
	}

	const object = callee.type === 'MemberExpression' ? unwrapExpression(callee.object) : undefined;
	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& object?.type === 'Identifier'
		&& callee.property.type === 'Identifier'
		&& SCHEDULER_NAMES.has(callee.property.name)
		&& timerImports.namespaces.has(object.name)
		&& isImportBinding(object, sourceCode)) {
		return callee.property.name;
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

function hasUnevaluatedClassFieldBetween(node, boundary) {
	let child = node;
	for (let current = node.parent; current && current !== boundary; child = current, current = current.parent) {
		if (
			isDeferredClassField(current)
			&& current.value === child
		) {
			return true;
		}
	}

	return false;
}

function getDetachedScheduler(node, activeCallback, timerImports, sourceCode) {
	const scheduler = getSchedulerName(node, timerImports, sourceCode);
	const callback = unwrapTypeScriptExpression(node.arguments[0]);
	if (
		!scheduler
		|| !isInlineCallback(callback)
	) {
		return undefined;
	}

	const promiseExpression = getPromiseExpression(node, activeCallback, sourceCode);
	const promiseExecutor = promiseExpression && unwrapTypeScriptExpression(promiseExpression.arguments[0]);
	const enclosingFunction = getEnclosingFunction(node);
	const isInsidePromiseExecutor = enclosingFunction === promiseExecutor;
	if (
		(enclosingFunction === activeCallback || isInsidePromiseExecutor)
		&& !(isInsidePromiseExecutor && isExpressionConsumed(promiseExpression))
	) {
		return {callback, scheduler};
	}

	return undefined;
}

function isExpressionConsumed(node) {
	while (
		isExpressionWrapper(node.parent)
		|| (node.parent?.type === 'MemberExpression' && node.parent.object === node)
		|| (node.parent?.type === 'CallExpression' && node.parent.callee === node)
	) {
		node = node.parent;
	}

	return getFloatingExpression(node) === undefined;
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
		if (WAIT_PLAN_PREFIX_STATEMENT_TYPES.has(statement.type)) {
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
		return isInlineCallback(callback) && getEffectiveArity(callback.params) < 2 ? callback : undefined;
	}

	if (!isTrackedSubtestCall(node, contextParameters, sourceCode)) {
		return undefined;
	}

	const callback = getTestCallback(node);
	return isInlineCallback(callback) && getEffectiveArity(callback.params) < 2 ? callback : undefined;
}

function isInsideGeneratorBody(node, callback) {
	return callback.generator && isInsideCallbackBody(node, callback);
}

function isInsideCallbackBody(node, callback) {
	for (let current = node.parent; current && current !== callback; current = current.parent) {
		if (current === callback.body) {
			return true;
		}
	}

	return false;
}

function isInsideSuppliedContextDefault(node, callback) {
	const parameter = callback.params[0];
	if (parameter?.type !== 'AssignmentPattern') {
		return false;
	}

	for (let current = node; current && current !== callback; current = current.parent) {
		if (current === parameter.right) {
			return true;
		}
	}

	return false;
}

function isInsideUnevaluatedCallbackRegion(node, callback) {
	return hasUnevaluatedClassFieldBetween(node, callback)
		|| isInsideGeneratorBody(node, callback)
		|| isInsideSuppliedContextDefault(node, callback);
}

function isDirectlyEvaluatedByCallback(node, callback) {
	return getEnclosingFunction(node) === callback && !isInsideUnevaluatedCallbackRegion(node, callback);
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
	const timerImports = getTimerImports(sourceCode);
	const detachedCallbacks = new WeakSet();
	const callbackStack = [];

	context.on('CallExpression', node => {
		const activeFrame = callbackStack.at(-1);
		const contextParameters = callbackStack.map(frame => frame.contextParameter).filter(Boolean);
		const boundaryCallback = !activeFrame || isDirectlyEvaluatedByCallback(node, activeFrame.callback)
			? getTestBoundaryCallback(node, imports, contextParameters, sourceCode)
			: undefined;
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

		if (!activeFrame || activeFrame.hasWaitPlan) {
			return;
		}

		if (isInsideUnevaluatedCallbackRegion(node, activeFrame.callback)) {
			return;
		}

		const detachedScheduler = getDetachedScheduler(node, activeFrame.callback, timerImports, sourceCode);
		if (detachedScheduler) {
			detachedCallbacks.add(detachedScheduler.callback);
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
		const activeFrame = callbackStack.at(-1);
		const contextParameters = callbackStack.map(frame => frame.contextParameter).filter(Boolean);
		const boundaryCallback = !activeFrame || isDirectlyEvaluatedByCallback(node, activeFrame.callback)
			? getTestBoundaryCallback(node, imports, contextParameters, sourceCode)
			: undefined;

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

		const activeCallback = activeFrame?.callback;
		if (!activeCallback) {
			return;
		}

		if (isInsideUnevaluatedCallbackRegion(node, activeCallback)) {
			return;
		}

		if (!assertionsOnly) {
			if (activeFrame.hasWaitPlan) {
				return;
			}

			const detachedScheduler = getDetachedScheduler(node, activeCallback, timerImports, sourceCode);
			if (detachedScheduler) {
				return findCallbackActivities(detachedScheduler.callback, {
					imports,
					contextParameters,
					sourceCode,
					visitorKeys,
				}).map(activity => ({
					node: activity.node,
					messageId,
					data: {activity: activity.type, scheduler: `${detachedScheduler.scheduler}()`},
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
			&& isInsideCallbackBody(floatingExpression.expression, activeCallback)
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
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
