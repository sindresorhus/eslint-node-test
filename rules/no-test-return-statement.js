import {findVariable} from '@eslint-community/eslint-utils';
import {
	HOOK_FUNCTIONS,
	resolveImports,
	parseTestCall,
	getTestCallback,
	getSubtestReceiver,
	createContextTracker,
} from './utils/node-test.js';
import isFunction from './ast/is-function.js';
import isPromiseType from './utils/is-promise-type.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-test-return-statement';

const messages = {
	[MESSAGE_ID]: 'Do not return a concrete value from a test or hook. Return a Promise to signal async completion, or return nothing.',
};

// "Nothing" types and types we cannot pin down, all fine to return.
const ALLOWED_TYPE_STRINGS = new Set(['void', 'undefined', 'null', 'any', 'never', 'unknown']);

/*
Whether the type is safe to return from a test or hook: a returned Promise (awaited by `node:test`),
a "nothing" type, or a type we cannot resolve. Anything else is a concrete value.
*/
function isAllowedReturnType(type, checker) {
	if (type.isUnion()) {
		return type.types.every(member => isAllowedReturnType(member, checker));
	}

	// `isPromiseType` returns `undefined` when indeterminate; only a definite `false` is a value.
	if (isPromiseType(type, checker) !== false) {
		return true;
	}

	return ALLOWED_TYPE_STRINGS.has(checker.typeToString(type));
}

function getHookCallback(callExpression) {
	const firstArgument = unwrapTypeScriptExpression(callExpression.arguments[0]);
	if (firstArgument && isFunction(firstArgument)) {
		return firstArgument;
	}

	return undefined;
}

function isDisallowedReturnValue(node, parserServices, checker) {
	let type;
	try {
		type = parserServices.getTypeAtLocation(node);
	} catch {
		return false;
	}

	return !isAllowedReturnType(type, checker);
}

function getCallbackContextVariable(callback, sourceCode) {
	const parameter = callback.params[0];
	if (parameter?.type !== 'Identifier') {
		return undefined;
	}

	return sourceCode.getDeclaredVariables(callback).find(variable => variable.identifiers.includes(parameter));
}

function isExtraContextReference(node, state) {
	if (node?.type !== 'Identifier') {
		return false;
	}

	const variable = findVariable(state.sourceCode.getScope(node), node);
	return variable !== undefined && state.extraContextVariables.includes(variable);
}

function isContextHookCall(callExpression, state) {
	const {callee} = callExpression;
	return callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.object.type === 'Identifier'
		&& (
			state.tracker.isContextReference(callee.object)
			|| isExtraContextReference(callee.object, state)
		)
		&& callee.property.type === 'Identifier'
		&& HOOK_FUNCTIONS.has(callee.property.name);
}

function isExtraContextSubtestCall(callExpression, state) {
	const receiver = getSubtestReceiver(callExpression);
	return receiver !== undefined && isExtraContextReference(receiver, state);
}

function getCheckedCallback(callExpression, state) {
	const parsed = parseTestCall(callExpression, state.imports);
	if (parsed?.kind === 'test') {
		return getTestCallback(callExpression);
	}

	if (parsed?.kind === 'hook') {
		return getHookCallback(callExpression);
	}

	if (state.tracker.isSubtestCall(callExpression) || isExtraContextSubtestCall(callExpression, state)) {
		return getTestCallback(callExpression);
	}

	if (isContextHookCall(callExpression, state)) {
		return getHookCallback(callExpression);
	}

	return undefined;
}

function isHookCall(callExpression, state) {
	return parseTestCall(callExpression, state.imports)?.kind === 'hook'
		|| isContextHookCall(callExpression, state);
}

function shouldTrackExtraContext(callExpression, state) {
	return isHookCall(callExpression, state)
		|| isExtraContextSubtestCall(callExpression, state);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// This rule relies on type information to tell a Promise from a plain value. Without it
	// (plain JavaScript, or TypeScript linted without a program), do nothing.
	const {parserServices} = context.sourceCode;
	if (!parserServices?.program) {
		return;
	}

	const checker = parserServices.program.getTypeChecker();
	const checkedCallbacks = new Set();
	const state = {
		imports,
		sourceCode,
		tracker: createContextTracker(imports),
		extraContextVariables: [],
	};
	const extraContextCalls = new Set();

	context.on('CallExpression', node => {
		const callback = getCheckedCallback(node, state);
		const shouldTrackContext = callback && shouldTrackExtraContext(node, state);
		state.tracker.update(node);
		if (!callback) {
			return;
		}

		checkedCallbacks.add(callback);

		if (shouldTrackContext) {
			state.extraContextVariables.push(getCallbackContextVariable(callback, sourceCode));
			extraContextCalls.add(node);
		}

		if (
			callback.type === 'ArrowFunctionExpression'
			&& callback.body.type !== 'BlockStatement'
			&& !callback.async
			&& isDisallowedReturnValue(callback.body, parserServices, checker)
		) {
			return {
				node: callback.body,
				messageId: MESSAGE_ID,
			};
		}
	});

	context.onExit('CallExpression', node => {
		state.tracker.leave(node);

		if (!extraContextCalls.has(node)) {
			return;
		}

		extraContextCalls.delete(node);
		state.extraContextVariables.pop();
	});

	context.on('ReturnStatement', node => {
		if (!node.argument) {
			return;
		}

		// The return must belong to the test/hook callback itself, not a nested helper function.
		let enclosing = node.parent;
		while (enclosing && !isFunction(enclosing)) {
			enclosing = enclosing.parent;
		}

		if (!enclosing || !checkedCallbacks.has(enclosing)) {
			return;
		}

		// An `async` function always wraps its return value in a Promise, which `node:test`
		// awaits, so returning a plain value there is fine.
		if (enclosing.async) {
			return;
		}

		if (!isDisallowedReturnValue(node.argument, parserServices, checker)) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow returning a concrete non-Promise value from a test or hook.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
