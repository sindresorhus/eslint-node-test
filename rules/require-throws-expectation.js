import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'require-throws-expectation';

const messages = {
	[MESSAGE_ID]: '`{{method}}()` accepts any thrown value. Pass an error matcher (error class, `RegExp`, validation object, or function) as the second argument.',
};

const THROWS_METHODS = new Set(['throws', 'rejects']);

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const parsed = parseSupportedAssertionCall(node, imports, tracker);
		if (!parsed || !THROWS_METHODS.has(parsed.method)) {
			return;
		}

		// The single-argument form has no matcher at all, and an explicit `undefined` or `null` is
		// what `node:test`'s `assert` treats as no matcher: both match any thrown value. A spread
		// could expand to a matcher, and any other expression may be one at runtime.
		const [first] = node.arguments;
		// A call with no arguments at all is an arity problem, which `assertion-arguments` reports.
		if (!first || first.type === 'SpreadElement') {
			return;
		}

		const second = node.arguments[1] && unwrapTypeScriptExpression(node.arguments[1]);
		if (second?.type === 'SpreadElement') {
			return;
		}

		// `undefined` is an identifier in the AST and `null` a literal; both are what `node:assert`
		// reads as "no matcher".
		const hasNoMatcher = second === undefined
			|| (second.type === 'Identifier' && second.name === 'undefined')
			|| (second.type === 'Literal' && second.value === null);
		if (!hasNoMatcher) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
			data: {method: parsed.method},
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
			description: 'Require an error matcher for `assert.throws()`/`assert.rejects()`.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
