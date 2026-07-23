import {resolveImports, createContextTracker, getSubtestReceiver} from './utils/node-test.js';
import {getEnclosingFunction, getFloatingStatement} from './utils/index.js';
import {trackDetachedCallbacks} from './no-unawaited-promise-assertion.js';

const MESSAGE_ID = 'no-unawaited-subtest';

const messages = {
	[MESSAGE_ID]: 'Subtest `{{name}}.test()` must be awaited or returned, otherwise it is cancelled when the parent test finishes.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);
	const isInsideDetachedCallback = trackDetachedCallbacks(context);

	context.on('CallExpression', node => {
		// Whether this is a floating subtest must be decided against the current stack,
		// before this call pushes its own context.
		const subtest = tracker.isSubtestCall(node);

		// A cast like `t.test('x', fn) as any` or a `void` discard must not hide a floating subtest.
		const floating = getFloatingStatement(node);

		let problem;
		if (subtest && floating && !isInsideDetachedCallback(node)) {
			const {name} = getSubtestReceiver(node);

			problem = {
				node,
				messageId: MESSAGE_ID,
				data: {name},
			};

			// `await` is only valid (and a behavior-preserving fix) inside an async function, and only
			// where prepending it is faithful (see `getFloatingStatement`).
			if (getEnclosingFunction(node)?.async && floating.canAwait) {
				problem.fix = fixer => fixer.insertTextBefore(node, 'await ');
			}
		}

		tracker.update(node);
		return problem;
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
			description: 'Require subtests created with the test context to be awaited or returned.',
			recommended: true,
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
