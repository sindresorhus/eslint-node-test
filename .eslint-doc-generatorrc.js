/** @type {import('eslint-doc-generator').GenerateOptions} */
const config = {
	configEmoji: [
		['recommended', '✅'],
		['unopinionated', '☑️'],
	],
	ignoreConfig: [
		'all',
	],
	ignoreDeprecatedRules: false,
	ruleDocTitleFormat: 'name',
	ruleListColumns: [
		'name',
		'description',
		'configsError',
		// Omit `configsOff` since we don't intend to convey meaning by setting rules to `off` in the `recommended` config.
		'configsWarn',
		'fixable',
		'hasSuggestions',
		'requiresTypeChecking',
	],
	urlConfigs: 'https://github.com/sindresorhus/eslint-node-test#preset-configs',
};

export default config;
