import {resolveImports, isGlobalMock} from './utils/node-test.js';
import {unwrapExpression} from './utils/index.js';

const MESSAGE_ID = 'prefer-context-mock';

const messages = {
	[MESSAGE_ID]: 'Prefer `t.mock.{{accessor}}` over the global `mock.{{accessor}}`, which is not automatically restored between tests.',
};

// Accessors that create state which the global `mock` does not auto-restore.
const STATEFUL_ACCESSORS = new Set(['fn', 'method', 'getter', 'setter', 'property', 'module', 'timers']);

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		// Unwrap wrappers at each step so a mid-chain cast (`(mock.timers as any).enable()`) does not
		// break the walk down to the global `mock`.
		const callee = unwrapExpression(node.callee);
		const calledMethod = callee.type === 'MemberExpression'
			&& !callee.computed
			&& callee.property.type === 'Identifier'
			? callee.property.name
			: undefined;

		let member = callee;
		while (member.type === 'MemberExpression') {
			if (isGlobalMock(member.object, imports) && !member.computed && member.property.type === 'Identifier') {
				const accessor = member.property.name;
				if (STATEFUL_ACCESSORS.has(accessor)) {
					// `mock.timers` is only state-creating through `enable`; `reset` restores and
					// `tick`/`runAll` create no state. `t.mock` is a different tracker, so switching
					// those to it would be wrong (and throws for a never-enabled context tracker).
					if (accessor === 'timers' && calledMethod !== 'enable') {
						return;
					}

					return {
						node,
						messageId: MESSAGE_ID,
						data: {accessor},
					};
				}

				return;
			}

			member = unwrapExpression(member.object);
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Prefer the test context `t.mock` over the global `mock`.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
