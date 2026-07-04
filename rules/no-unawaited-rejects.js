import {
	resolveImports,
	parseAssertionCall,
	createContextTracker,
	isAssertionCallWithSupportedContext,
} from './utils/node-test.js';
import {getEnclosingFunction} from './utils/index.js';

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

		const parsed = parseAssertionCall(node, imports);
		if (!parsed || !isAssertionCallWithSupportedContext(node, tracker)) {
			return;
		}

		if (!REJECTS_METHODS.has(parsed.method)) {
			return;
		}

		// The call must be an ExpressionStatement (i.e. bare call, not awaited/returned/assigned).
		const {parent} = node;
		if (!parent || parent.type !== 'ExpressionStatement') {
			return;
		}

		const enclosingFunction = getEnclosingFunction(node);
		const isInAsyncFunction = enclosingFunction?.async === true;

		if (isInAsyncFunction) {
			// Can autofix with `await`.
			return {
				node,
				messageId: MESSAGE_ID,
				data: {method: parsed.method},
				fix: fixer => fixer.insertTextBefore(node, 'await '),
			};
		}

		// Not in an async function — report without a fix (await would be a syntax error here).
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
