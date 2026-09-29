import {isSameReference} from './utils/index.js';
import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';

const MESSAGE_ID_ALWAYS_PASSES = 'no-identical-assertion-arguments/always-passes';
const MESSAGE_ID_ALWAYS_FAILS = 'no-identical-assertion-arguments/always-fails';

const messages = {
	[MESSAGE_ID_ALWAYS_PASSES]: 'Both arguments are the same, so this assertion always passes.',
	[MESSAGE_ID_ALWAYS_FAILS]: 'Both arguments are the same, so this assertion always fails.',
};

// Two-operand `node:assert` comparisons. The negated ones always fail on identical operands.
const POSITIVE_METHODS = new Set(['equal', 'strictEqual', 'deepEqual', 'deepStrictEqual', 'partialDeepStrictEqual']);
const NEGATED_METHODS = new Set(['notEqual', 'notStrictEqual', 'notDeepEqual', 'notDeepStrictEqual']);

// The deep methods compare structure, so two identical `RegExp` literals are the same value to them. The other methods compare identity, and two separate `RegExp` literals are always distinct objects, so the operands are not "the same reference" the messages rely on.
const STRUCTURAL_METHODS = new Set(['deepEqual', 'deepStrictEqual', 'notDeepEqual', 'notDeepStrictEqual', 'partialDeepStrictEqual']);

/** Whether a node is a `RegExp` literal. */
function isRegExpLiteral(node) {
	return node?.type === 'Literal' && Boolean(node.regex);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	// Activate on a `node:assert` import, or in a test file where `t.assert.*` may be used.
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

		const isNegated = NEGATED_METHODS.has(assertion.method);
		if (!isNegated && !POSITIVE_METHODS.has(assertion.method)) {
			return;
		}

		const [first, second] = node.arguments;
		if (
			!first
			|| !second
			|| first.type === 'SpreadElement'
			|| second.type === 'SpreadElement'
		) {
			return;
		}

		if (!isSameReference(first, second)) {
			return;
		}

		// Two distinct `RegExp` literals are different objects, so a reference comparison of them is not the "same value" case this rule reports. Only the deep methods, which compare structure, treat identical patterns as equal.
		if (!STRUCTURAL_METHODS.has(assertion.method) && isRegExpLiteral(first) && isRegExpLiteral(second)) {
			return;
		}

		return {
			node,
			messageId: isNegated ? MESSAGE_ID_ALWAYS_FAILS : MESSAGE_ID_ALWAYS_PASSES,
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
			description: 'Disallow comparing a value to itself in an assertion.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
