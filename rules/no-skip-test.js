import createTestModifierRule from './shared/test-modifier-rule.js';

/** @type {import('eslint').Rule.RuleModule} */
const config = createTestModifierRule({
	modifier: 'skip',
	description: 'Disallow the `.skip` test modifier.',
	errorMessage: 'Do not skip tests.',
	recommended: true,
});

export default config;
