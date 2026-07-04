import {
	resolveImports,
	parseAssertionCall,
	createContextTracker,
	isAssertionCallWithSupportedContext,
} from './utils/node-test.js';
import {isFunction} from './ast/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID_TOO_FEW = 'too-few-arguments';
const MESSAGE_ID_TOO_MANY = 'too-many-arguments';
const MESSAGE_ID_NOT_STRING = 'not-string-message';

/*
Map of node:assert method -> required argument count.
Each method also accepts one optional trailing `message` argument, making max = required + 1.
`fail` is omitted because it accepts 0 or 1 args (ambiguous) — not checkable.
`throws`/`doesNotThrow`/`rejects`/`doesNotReject` accept 1 required + optional error + optional message (max 3).
`ifError` is the exception with no trailing message argument — it accepts exactly one value (max = min = 1).
`snapshot` is omitted because its optional second argument is an options object, not a message string,
so it does not fit this map's "trailing string message" model (and it is a `node:test` context
assertion rather than a `node:assert` method).
*/
const ASSERTION_ARGS = new Map([
	['ok', {min: 1, max: 2}],
	['equal', {min: 2, max: 3}],
	['notEqual', {min: 2, max: 3}],
	['strictEqual', {min: 2, max: 3}],
	['notStrictEqual', {min: 2, max: 3}],
	['deepEqual', {min: 2, max: 3}],
	['notDeepEqual', {min: 2, max: 3}],
	['deepStrictEqual', {min: 2, max: 3}],
	['notDeepStrictEqual', {min: 2, max: 3}],
	['match', {min: 2, max: 3}],
	['doesNotMatch', {min: 2, max: 3}],
	['throws', {min: 1, max: 3}],
	['doesNotThrow', {min: 1, max: 3}],
	['rejects', {min: 1, max: 3}],
	['doesNotReject', {min: 1, max: 3}],
	['ifError', {min: 1, max: 1}],
]);

/*
The optional trailing `message` argument accepts a string or an `Error`. Only flag values that
are statically known to be neither: object/array/function literals, or non-string literals
(numbers, booleans, `null`, regexes). Identifiers, calls, member expressions, template
literals, conditionals, logical/binary expressions, and TypeScript casts can all resolve to a
string or `Error` at runtime, so they are left alone to avoid false positives.
*/
function isInvalidMessageArgument(node) {
	node = unwrapTypeScriptExpression(node);

	if (node.type === 'ArrayExpression' || node.type === 'ObjectExpression' || isFunction(node)) {
		return true;
	}

	return node.type === 'Literal' && typeof node.value !== 'string';
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const assertion = parseAssertionCall(node, imports);
		if (!assertion || !isAssertionCallWithSupportedContext(node, tracker)) {
			return;
		}

		const {method} = assertion;
		const expected = ASSERTION_ARGS.get(method);
		if (!expected) {
			// Unknown method or `fail` — skip.
			return;
		}

		// Skip calls with spread arguments — arg count is not statically known.
		if (node.arguments.some(argument => argument.type === 'SpreadElement')) {
			return;
		}

		const {min, max} = expected;
		const count = node.arguments.length;

		if (count < min) {
			return {
				node,
				messageId: MESSAGE_ID_TOO_FEW,
				data: {min},
			};
		}

		if (count > max) {
			return {
				node,
				messageId: MESSAGE_ID_TOO_MANY,
				data: {max},
			};
		}

		// If a trailing message argument is present, it must be a string.
		// The message argument is the last arg when count > min (i.e. it is optional and present).
		// For methods where max === min there is no message slot — skip.
		if (count === max && max > min) {
			const lastArg = node.arguments.at(-1);
			if (isInvalidMessageArgument(lastArg)) {
				return {
					node: lastArg,
					messageId: MESSAGE_ID_NOT_STRING,
				};
			}
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Enforce the correct number of arguments for `node:assert` assertions.',
			recommended: 'unopinionated',
		},
		fixable: undefined,
		schema: [],
		messages: {
			[MESSAGE_ID_TOO_FEW]: 'Not enough arguments. Expected at least {{min}}.',
			[MESSAGE_ID_TOO_MANY]: 'Too many arguments. Expected at most {{max}}.',
			[MESSAGE_ID_NOT_STRING]: 'Assertion message must be a string or an `Error`.',
		},
		languages: ['js/js'],
	},
};

export default config;
