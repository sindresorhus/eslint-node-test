import createTestModifierRule from './shared/test-modifier-rule.js';

/** @type {import('eslint').Rule.RuleModule} */
const config = createTestModifierRule({
	modifier: 'todo',
	description: 'Disallow the `.todo` test modifier.',
	errorMessage: 'Do not commit `.todo` tests.',
	recommended: false,
});

export default config;
