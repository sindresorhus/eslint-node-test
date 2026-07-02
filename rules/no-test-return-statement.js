import {resolveImports, parseTestCall, getTestCallback} from './utils/node-test.js';
import isFunction from './ast/is-function.js';
import isPromiseType from './utils/is-promise-type.js';

const MESSAGE_ID = 'no-test-return-statement';

const messages = {
	[MESSAGE_ID]: 'Do not return a value from a test. Return a Promise to signal async completion, or return nothing.',
};

// "Nothing" types and types we cannot pin down — all fine to return.
const ALLOWED_TYPE_STRINGS = new Set(['void', 'undefined', 'null', 'any', 'never', 'unknown']);

/*
Whether the type is safe to return from a test: a returned Promise (awaited by `node:test`),
a "nothing" type, or a type we cannot resolve. Anything else is a concrete value.
*/
function isAllowedReturnType(type, checker) {
	// `isPromiseType` returns `undefined` when indeterminate; only a definite `false` is a value.
	if (isPromiseType(type, checker) !== false) {
		return true;
	}

	if (type.isUnion()) {
		return type.types.every(member => isAllowedReturnType(member, checker));
	}

	return ALLOWED_TYPE_STRINGS.has(checker.typeToString(type));
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
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
	const testCallbacks = new Set();

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (parsed?.kind !== 'test') {
			return;
		}

		const callback = getTestCallback(node);
		if (callback) {
			testCallbacks.add(callback);
		}
	});

	context.on('ReturnStatement', node => {
		if (!node.argument) {
			return;
		}

		// The return must belong to the test callback itself, not a nested helper function.
		let enclosing = node.parent;
		while (enclosing && !isFunction(enclosing)) {
			enclosing = enclosing.parent;
		}

		if (!enclosing || !testCallbacks.has(enclosing)) {
			return;
		}

		// An `async` function always wraps its return value in a Promise, which `node:test`
		// awaits, so returning a plain value there is fine.
		if (enclosing.async) {
			return;
		}

		let type;
		try {
			type = parserServices.getTypeAtLocation(node.argument);
		} catch {
			return;
		}

		if (isAllowedReturnType(type, checker)) {
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
			description: 'Disallow returning a non-Promise value from a test.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
