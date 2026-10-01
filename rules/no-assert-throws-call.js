import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import {unwrapExpression, getStaticPropertyName} from './utils/index.js';
import isFunction from './ast/is-function.js';

const MESSAGE_ID_ERROR = 'no-assert-throws-call/error';
const MESSAGE_ID_SUGGESTION = 'no-assert-throws-call/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: '`{{method}}()` expects a function callback. The first argument is evaluated before the assertion starts, so what it does escapes it.',
	[MESSAGE_ID_SUGGESTION]: 'Wrap the call in an arrow function.',
};

function isBindCall(node) {
	// A parenthesized optional chain puts the `ChainExpression` on the callee, so `(parse?.bind)(null)` is the same function-producing call as `parse?.bind(null)`.
	const callee = unwrapExpression(node.callee);

	// `fn['bind'](null)` is the same function-producing call as `fn.bind(null)`.
	return callee.type === 'MemberExpression' && getStaticPropertyName(callee) === 'bind';
}

function isFunctionConstructorCall(node) {
	return node.callee.type === 'Identifier' && node.callee.name === 'Function';
}

function isFunctionProducingCall(node) {
	return isBindCall(node) || isFunctionConstructorCall(node);
}

const emptyAnalysis = () => ({runs: false, awaits: false, yields: false});

/*
What evaluating `node` does, outside any nested function (whose body is a separate evaluation):

- `runs`: it does work before it yields its value: a call that is not producing the function to hand
  over, a `new`, or a tagged template. `assert.throws()` can only catch what happens after it starts,
  so any of these escapes the assertion entirely, whether the expression is the argument itself
  (`assert.throws(parse(input))`) or wraps it (`assert.throws(flag ? parse(a) : null)`).
- `awaits`: it contains an `await`, which a synchronous arrow cannot hold, so the suggestion does not apply.
- `yields`: it contains a `yield`, which an arrow cannot hold, so the suggestion does not apply.

`assert.throws(() => parse(a))` is the fix, not a problem: a nested function is not evaluated while
the argument is. A function-producing call (`.bind()`, `Function()`, `new Function()`) is not looked
inside either: its receiver and arguments are the setup that builds the function to hand over.
*/
function analyzeArgument(node, sourceCode, result = emptyAnalysis()) {
	if (!node) {
		return result;
	}

	switch (node.type) {
		case 'CallExpression': {
			if (isFunctionProducingCall(node)) {
				return result;
			}

			result.runs = true;

			break;
		}

		case 'NewExpression': {
			// `new Function(…)` builds the function to hand over, as `Function(…)` does.
			if (isFunctionConstructorCall(node)) {
				return result;
			}

			result.runs = true;

			break;
		}

		case 'TaggedTemplateExpression': {
			result.runs = true;

			break;
		}

		case 'AwaitExpression': {
			result.awaits = true;

			break;
		}

		case 'YieldExpression': {
			result.yields = true;

			break;
		}
	// No default
	}

	// A nested function is a separate evaluation, so its body is not evaluated here.
	if (!isFunction(node)) {
		for (const key of sourceCode.visitorKeys[node.type] ?? []) {
			const child = node[key];
			if (Array.isArray(child)) {
				for (const element of child) {
					analyzeArgument(element, sourceCode, result);
				}
			} else {
				analyzeArgument(child, sourceCode, result);
			}
		}
	}

	return result;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const assertion = parseSupportedAssertionCall(node, imports, tracker);
		if (!assertion || assertion.method !== 'throws') {
			return;
		}

		const [firstArgument] = node.arguments;
		if (!firstArgument || firstArgument.type === 'SpreadElement') {
			return;
		}

		const argument = unwrapExpression(firstArgument);
		const {runs, awaits, yields} = analyzeArgument(argument, sourceCode);
		if (!runs) {
			return;
		}

		// Only an argument that is itself a call is sure to hand over the call's result. Any other shape may end in a function (`flag ? parse(a) : fallback`, `(parse(a), fallback)`, `getHandlers().onError`), which the suggested arrow would return instead of call.
		const isCall = ['CallExpression', 'NewExpression', 'TaggedTemplateExpression'].includes(argument.type);

		return {
			node: firstArgument,
			messageId: MESSAGE_ID_ERROR,
			data: {method: assertion.method},
			// A `yield` cannot live in an arrow, so that form is reported without a suggestion. An `await` in the argument cannot go inside the arrow without making it `async`, and `assert.throws()` calls an async function without awaiting its promise (it fails with `Missing expected exception.` and the rejection goes unhandled), so that shape is reported without a suggestion (`no-assert-throws-async` owns turning it into `assert.rejects()`).
			suggest: awaits || yields || !isCall
				? undefined
				: [
					{
						messageId: MESSAGE_ID_SUGGESTION,
						// The argument goes in parentheses: a `{` or `function` at the start of the arrow body would otherwise parse as a block or a declaration.
						fix: fixer => fixer.replaceText(firstArgument, `() => (${sourceCode.getText(firstArgument)})`),
					},
				],
		};
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
			description: 'Disallow calling the function passed to `assert.throws()`.',
			recommended: 'unopinionated',
		},
		hasSuggestions: true,
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
