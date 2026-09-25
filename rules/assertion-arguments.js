import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID_TOO_FEW = 'too-few-arguments';
const MESSAGE_ID_TOO_MANY = 'too-many-arguments';
const MESSAGE_ID_NOT_STRING = 'not-string-message';

/*
Map of node:assert method -> required argument count, and the argument count at which the last one is
the `message` (so max = required + 1 for the plain comparisons).

`fail` is omitted because it accepts 0 or 1 args (ambiguous) — not checkable.
`throws`/`doesNotThrow`/`rejects`/`doesNotReject` accept 1 required + optional error + optional message.
`ifError` is the exception with no trailing message argument — it takes one value and ignores the rest. It also needs no value: it throws only for an argument that is neither `null` nor `undefined`, so a missing argument passes just like an explicit `undefined`.
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
	['partialDeepStrictEqual', {min: 2, max: 3}],
	['match', {min: 2, max: 3}],
	['doesNotMatch', {min: 2, max: 3}],
	['throws', {min: 1, max: 3}],
	['doesNotThrow', {min: 1, max: 3}],
	['rejects', {min: 1, max: 3}],
	['doesNotReject', {min: 1, max: 3}],
	['ifError', {min: 0, max: 1, hasMessage: false}],
]);

/*
`node:assert` accepts a `null` message for `ok()` and the `match` family, where it uses the default
message. The two-operand comparisons reject it with `ERR_INVALID_ARG_TYPE` as soon as the assertion
fails, so there a `null` message is a latent crash. Node validates the message lazily, so in those
methods it only matters once the assertion fails.
*/
const METHODS_ACCEPTING_NULL_MESSAGE = new Set(['ok', 'match', 'doesNotMatch']);

/*
`match()` and `doesNotMatch()` only ask whether their message is truthy, so any falsy value is
accepted there and the assertion simply fails with the default message. Every other method type-checks
the message, and rejects even a falsy `0`.
*/
const METHODS_ACCEPTING_FALSY_MESSAGE = new Set(['match', 'doesNotMatch']);

/*
`throws()`, `doesNotThrow()`, `rejects()` and `doesNotReject()` take exactly `(fn, error, message)`:
`node:assert` never type-checks that message (it is stringified into the failure text) and silently
drops anything past it, so an extra argument there is a mistake and a message of any value is fine.
The other methods here declare the message as a rest parameter, so since Node 26 it is a
`util.format` string and any number of substitution arguments may follow it.
*/
const METHODS_WITHOUT_MESSAGE_FORMATTING = new Set(['throws', 'doesNotThrow', 'rejects', 'doesNotReject']);

/*
The optional trailing `message` argument accepts a string, an `Error`, or a function that Node calls
to produce the message. Only flag values that are statically known to be none of those: object/array
literals, or non-string literals (numbers, booleans, regexes, and `null` where the method rejects
it). Identifiers, calls, member expressions, template literals, conditionals, logical/binary
expressions, and TypeScript casts can all resolve to a valid message at runtime, so they are left
alone to avoid false positives.
*/
function isInvalidMessageArgument(node, method) {
	node = unwrapTypeScriptExpression(node);

	if (node.type === 'ArrayExpression' || node.type === 'ObjectExpression') {
		return true;
	}

	// A function is called to build the message, and any other expression may be a string at runtime,
	// so only a literal is judged here.
	if (node.type !== 'Literal') {
		return false;
	}

	if (node.value === null) {
		return !METHODS_ACCEPTING_NULL_MESSAGE.has(method);
	}

	if (typeof node.value === 'string') {
		return false;
	}

	return !(METHODS_ACCEPTING_FALSY_MESSAGE.has(method) && !node.value);
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

		const assertion = parseSupportedAssertionCall(node, imports, tracker);
		if (!assertion) {
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

		const {min, max, hasMessage = true} = expected;
		const count = node.arguments.length;

		if (count < min) {
			return {
				node,
				messageId: MESSAGE_ID_TOO_FEW,
				data: {min},
			};
		}

		// For methods where max === min there is no message slot, and `ifError` has no message slot at
		// all: its only argument is the value, which may be any expression.
		if (!hasMessage || max <= min) {
			return;
		}

		if (METHODS_WITHOUT_MESSAGE_FORMATTING.has(method)) {
			// Anything past the message is dropped, so it is a surplus argument the runner ignores.
			if (count > max) {
				return {
					node,
					messageId: MESSAGE_ID_TOO_MANY,
					data: {max},
				};
			}

			return;
		}

		// The message sits in the last slot the method reads, and printf-style substitution arguments
		// may follow it, so the slot is checked from there on.
		if (count >= max && isInvalidMessageArgument(node.arguments[max - 1], method)) {
			return {
				node: node.arguments[max - 1],
				messageId: MESSAGE_ID_NOT_STRING,
			};
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
			[MESSAGE_ID_NOT_STRING]: 'Assertion message must be a string, an `Error`, or a function.',
		},
		languages: ['js/js'],
	},
};

export default config;
