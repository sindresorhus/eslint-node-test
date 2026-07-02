import {resolveImports, isGlobalMock} from './utils/node-test.js';

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

	if (imports.mockLocals.size === 0 && !imports.namespace) {
		return;
	}

	context.on('CallExpression', node => {
		let member = node.callee;
		while (member.type === 'MemberExpression') {
			if (isGlobalMock(member.object, imports) && !member.computed && member.property.type === 'Identifier') {
				const accessor = member.property.name;
				if (STATEFUL_ACCESSORS.has(accessor)) {
					return {
						node,
						messageId: MESSAGE_ID,
						data: {accessor},
					};
				}

				return;
			}

			member = member.object;
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
