import createTestModifierRule from './shared/test-modifier-rule.js';

/** @type {import('eslint').Rule.RuleModule} */
const config = createTestModifierRule({
	modifier: 'only',
	description: 'Disallow the `.only` test modifier.',
	errorMessage: 'Do not use the `.only` test modifier: under `--test-only` it stops the rest of the suite from running.',
	recommended: 'unopinionated',
});

export default config;
