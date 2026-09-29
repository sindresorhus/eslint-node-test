import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import {getEnclosingFunction, getFloatingStatement, hasStaticBlockBetween} from './utils/index.js';

const MESSAGE_ID = 'no-unawaited-rejects/error';

const messages = {
	[MESSAGE_ID]: '`assert.{{method}}()` must be awaited or returned.',
};

const REJECTS_METHODS = new Set(['rejects', 'doesNotReject']);

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
		if (!parsed || !REJECTS_METHODS.has(parsed.method)) {
			return;
		}

		const floating = getFloatingStatement(node);
		if (!floating) {
			return;
		}

		// Only autofix where prepending `await` is faithful in an async function: `await` would be a
		// syntax error outside one or inside a class static block, and a `void`-discarded or type-asserted call cannot take it (see `getFloatingStatement`), so those are reported without a fix (matching `no-unawaited-promise-assertion` and `no-unawaited-subtest`).
		const enclosingFunction = getEnclosingFunction(node);
		if (
			enclosingFunction?.async === true
			&& floating.canAwait
			&& !hasStaticBlockBetween(node, enclosingFunction)
		) {
			return {
				node,
				messageId: MESSAGE_ID,
				data: {method: parsed.method},
				fix: fixer => fixer.insertTextBefore(node, 'await '),
			};
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
			description: 'Require `assert.rejects()`/`assert.doesNotReject()` to be awaited or returned.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
