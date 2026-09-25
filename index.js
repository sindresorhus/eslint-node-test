import * as rawRules from './rules/index.js';
import {toEslintRules} from './rules/rule/index.js';
import packageJson from './package.json' with {type: 'json'};

const rules = toEslintRules(rawRules);

// A deprecated rule is off in every preset, whichever level it was declared at.
const presetRules = isEnabled => Object.fromEntries(Object.entries(rules).map(([id, rule]) => [
	`node-test/${id}`,
	!rule.meta.deprecated && isEnabled(rule) ? 'error' : 'off',
]));

const recommendedRules = presetRules(rule => Boolean(rule.meta.docs.recommended));

const unopinionatedRules = presetRules(rule => rule.meta.docs.recommended === 'unopinionated');

const allRules = presetRules(() => true);

const createConfig = (rules, flatConfigName) => ({
	name: flatConfigName,
	plugins: {
		'node-test': nodeTest,
	},
	rules,
});

const nodeTest = {
	meta: {
		// `eslint-doc-generator` derives the rule prefix from this name, expecting either the
		// `eslint-plugin-<prefix>` convention or the prefix itself; our package name doesn't
		// follow that convention, so use the prefix directly to keep doc generation working.
		name: 'node-test',
		version: packageJson.version,
	},
	rules,
};

const configs = {
	recommended: createConfig(recommendedRules, 'node-test/recommended'),
	unopinionated: createConfig(unopinionatedRules, 'node-test/unopinionated'),
	all: createConfig(allRules, 'node-test/all'),
};

nodeTest.configs = configs;

export default nodeTest;
