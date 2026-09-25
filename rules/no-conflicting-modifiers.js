import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	getTestOptions,
	findEnabledOptionsProperty,
	MODIFIERS,
} from './utils/node-test.js';

const MESSAGE_ID = 'no-conflicting-modifiers';

const messages = {
	[MESSAGE_ID]: 'Conflicting modifiers {{modifiers}}. `node:test` resolves them by precedence rather than reporting both: `skip` wins over everything, and `todo` wins over `expectFailure`.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// A subtest takes the same modifiers, through its options object.
	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		// A hook's options carry no modifier, so they cannot conflict.
		if ((!parsed && !isSubtest) || parsed?.kind === 'hook') {
			return;
		}

		const active = new Set();
		if (parsed?.hasExpectedFailure) {
			active.add('expectFailure');
		}

		// Chained form: `test.skip.only(…)`.
		for (const modifier of parsed?.modifiers ?? []) {
			if (MODIFIERS.has(modifier.name)) {
				active.add(modifier.name);
			}
		}

		// Options form: `test('t', {skip: true, only: true}, …)`.
		const options = getTestOptions(node);
		for (const name of MODIFIERS) {
			if (findEnabledOptionsProperty(options, name, context)) {
				active.add(name);
			}
		}

		if (findEnabledOptionsProperty(options, 'expectFailure', context)) {
			active.add('expectFailure');
		}

		// `only` composes with `todo` and with `expectFailure`: the runner applies each alongside it, so
		// a test that is both exclusive-only and a TODO, or both exclusive-only and expected to fail,
		// means what it says. Every other pair has a winner that swallows the loser: `skip` beats
		// everything, and `todo` beats `expectFailure`.
		const isComposingPair = active.size === 2 && active.has('only') && !active.has('skip');
		if (active.size < 2 || isComposingPair) {
			return;
		}

		const modifiers = [...active].toSorted((a, b) => a.localeCompare(b)).map(name => `\`${name}\``).join(', ');
		return {
			node,
			messageId: MESSAGE_ID,
			data: {modifiers},
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
			description: 'Disallow conflicting test modifiers.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
