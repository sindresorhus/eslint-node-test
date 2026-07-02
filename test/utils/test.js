import path from 'node:path';
import url from 'node:url';
import test, {describe, snapshot} from 'node:test';
import assert from 'node:assert/strict';
import {Linter} from 'eslint';
import plugin from '../../index.js';
import SnapshotRuleTester from './snapshot-rule-tester.js';
import parsers from './parsers.js';
import {DEFAULT_LANGUAGE_OPTIONS, normalizeLanguageOptions, mergeLanguageOptions} from './language-options.js';

// Store the pre-formatted snapshot strings verbatim instead of the default serializer.
snapshot.setDefaultSnapshotSerializers([value => value]);

const RULES_REPORTING_EMPTY_FILE = new Set([
	'no-empty-file',
]);

function normalizeTestCase(testCase, shouldNormalizeLanguageOptions = true) {
	if (typeof testCase === 'string') {
		testCase = {code: testCase};
	}

	if (shouldNormalizeLanguageOptions && testCase.languageOptions) {
		testCase = {...testCase, languageOptions: normalizeLanguageOptions(testCase.languageOptions)};
	}

	return testCase;
}

function assertNoManualEmptyFileTestCases(ruleId, testCases) {
	if (RULES_REPORTING_EMPTY_FILE.has(ruleId)) {
		return;
	}

	if (testCases.some(({code}) => code === '')) {
		throw new Error(`Do not add manual empty file test cases for \`${ruleId}\`. They are covered by the shared empty file test.`);
	}
}

// https://github.com/tc39/proposal-array-is-template-object
const isTemplateObject = value => Array.isArray(value?.raw);
// https://github.com/tc39/proposal-string-cooked
const cooked = (raw, ...substitutions) => String.raw({raw}, ...substitutions);

function only(...arguments_) {
	/*
	```js
	only`code`;
	```
	*/
	if (isTemplateObject(arguments_[0])) {
		return {code: cooked(...arguments_), only: true};
	}

	/*
	```js
	only('code');
	only({code: 'code'});
	```
	*/
	return {...normalizeTestCase(arguments_[0], /* shouldNormalizeLanguageOptions */ false), only: true};
}

function runEmptyFileTest(ruleId, rule) {
	// Empty input should be a no-op for every rule except the rule that exists to report it.
	if (RULES_REPORTING_EMPTY_FILE.has(ruleId)) {
		return;
	}

	test(`empty file: ${ruleId}`, () => {
		const linter = new Linter();
		const messages = linter.verify(
			'',
			// Avoid a separate `{files}` config-array entry here. It makes ESLint merge an extra config for every empty-file smoke test.
			{
				files: ['**'],
				languageOptions: DEFAULT_LANGUAGE_OPTIONS,
				linterOptions: {
					reportUnusedDisableDirectives: 'off',
				},
				plugins: {
					'rule-to-test': {
						rules: {
							[ruleId]: rule,
						},
					},
				},
				rules: {
					[`rule-to-test/${ruleId}`]: 'error',
				},
			},
			{filename: 'index.js'},
		);

		assert.deepStrictEqual(messages, []);
	});
}

function runSnapshot(ruleId, rule, tests) {
	let {testerOptions = {}, valid, invalid} = tests;

	valid = valid.map(testCase => normalizeTestCase(testCase));
	invalid = invalid.map(testCase => normalizeTestCase(testCase));
	assertNoManualEmptyFileTestCases(ruleId, [...valid, ...invalid]);

	const testConfig = {
		...testerOptions,
		languageOptions: mergeLanguageOptions(DEFAULT_LANGUAGE_OPTIONS, testerOptions.languageOptions),
	};

	// Group every case for the rule under one suite for readable output.
	describe(ruleId, () => {
		runEmptyFileTest(ruleId, rule);
		const tester = new SnapshotRuleTester(test, testConfig);
		tester.run(ruleId, rule, {valid, invalid});
	});
}

function getTester(importMeta) {
	const filename = url.fileURLToPath(importMeta.url);
	const ruleId = path.basename(filename, '.js');
	const rule = plugin.rules[ruleId];

	const snapshotTest = {
		snapshot: tests => runSnapshot(ruleId, rule, tests),
		only,
	};

	return {
		ruleId,
		rule,
		test: snapshotTest,
	};
}

const addComment = (testCase, comment) => {
	testCase = normalizeTestCase(testCase, /* shouldNormalizeLanguageOptions */ false);
	const {code, output} = testCase;
	const fixedTest = {
		...testCase,
		code: `${code}\n/* ${comment} */`,
	};
	if (Object.hasOwn(fixedTest, 'output') && typeof output === 'string') {
		fixedTest.output = `${output}\n/* ${comment} */`;
	}

	return fixedTest;
};

const avoidTestTitleConflict = (tests, comment) => {
	const {valid, invalid} = tests;
	return {
		...tests,
		valid: valid.map(testCase => addComment(testCase, comment)),
		invalid: invalid.map(testCase => addComment(testCase, comment)),
	};
};

export {
	normalizeTestCase,
	getTester,
	avoidTestTitleConflict,
};
export {default as parsers} from './parsers.js';
