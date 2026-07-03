import {findVariable} from '@eslint-community/eslint-utils';
import {
	HOOK_FUNCTIONS,
	MODIFIERS,
	resolveImports,
	parseTestCall,
	getTestCallback,
	getSubtestReceiver,
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

function isContextReference(node, state) {
	if (node?.type !== 'Identifier') {
		return false;
	}

	const variable = findVariable(state.sourceCode.getScope(node), node);
	return variable !== undefined && state.contextVariables.includes(variable);
}

function isContextHookCall(callExpression, state) {
	const {callee} = callExpression;
	return callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.object.type === 'Identifier'
		&& isContextReference(callee.object, state)
		&& callee.property.type === 'Identifier'
		&& HOOK_FUNCTIONS.has(callee.property.name);
}

function isContextSubtestCall(callExpression, state) {
	const receiver = getSubtestReceiver(callExpression);
	return receiver !== undefined && isContextReference(receiver, state);
}

function isHookMemberTestCall(parsed) {
	return parsed?.kind === 'test'
		&& parsed.modifiers.length === 1
		&& HOOK_FUNCTIONS.has(parsed.modifiers[0].name);
}

function getCheckedCallback(callExpression, state) {
	const parsed = parseTestCall(callExpression, state.imports);
	if (isHookMemberTestCall(parsed)) {
		return getHookCallback(callExpression);
	}

	if (parsed?.kind === 'test') {
		if (parsed.modifiers.some(modifier => !MODIFIERS.has(modifier.name))) {
			return undefined;
		}

		return getTestCallback(callExpression);
	}

	if (parsed?.kind === 'hook' && parsed.modifiers.length === 0) {
		return getHookCallback(callExpression);
	}

	if (isContextSubtestCall(callExpression, state)) {
		return getTestCallback(callExpression);
	}

	if (isContextHookCall(callExpression, state)) {
		return getHookCallback(callExpression);
	}

	return undefined;
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
		contextVariables: [],
	};
	const contextCalls = new Set();

	context.on('CallExpression', node => {
		const callback = getCheckedCallback(node, state);
		if (!callback) {
			return;
		}

		checkedCallbacks.add(callback);
		state.contextVariables.push(getCallbackContextVariable(callback, sourceCode));
		contextCalls.add(node);

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
		if (!contextCalls.has(node)) {
			return;
		}

		contextCalls.delete(node);
		state.contextVariables.pop();
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
