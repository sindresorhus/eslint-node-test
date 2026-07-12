/* Run all the plugin's own rules on this codebase */
/*
! If you're making a new rule, you can ignore this before review.
*/
import eslintNodeTest from './index.js';

const config = [
	eslintNodeTest.configs.all,
	{
		linterOptions: {
			reportUnusedDisableDirectives: false,
		},
		rules: {
			// The test command uses explicit globs, excluding internal helpers that match Node.js's default discovery.
			'node-test/no-import-test-files': 'off',
		},
	},
	{
		ignores: [
			'coverage',
			'.ai-temporary',
		],
	},
	{
		// Our own test files don't follow the conventions these opt-in rules expect from real
		// test suites: flat top-level `test()` calls instead of `describe` wrappers, case lists
		// asserted/branched/looped over in `test/unit`, capitalized titles, helpers exported from
		// `test/utils`, and filenames matching the rule under test rather than `*.test.js`.
		files: [
			'test/**/*.js',
		],
		rules: {
			'node-test/consistent-test-filename': 'off',
			'node-test/max-assertions': 'off',
			'node-test/no-conditional-assertion': 'off',
			'node-test/no-conditional-in-test': 'off',
			'node-test/no-export': 'off',
			'node-test/prefer-lowercase-title': 'off',
			'node-test/require-hook': 'off',
			'node-test/require-top-level-describe': 'off',
		},
	},
];

export default config;
