import fs, {promises as fsAsync} from 'node:fs';
import path from 'node:path';
import test, {before} from 'node:test';
import assert from 'node:assert/strict';
import {ESLint} from 'eslint';
import eslintNodeTest from '../index.js';

let ruleFiles;

before(async () => {
	const files = await fsAsync.readdir('rules');
	ruleFiles = files.filter(file => path.extname(file) === '.js' && path.basename(file) !== 'index.js');
});

test('Every rule is defined in index file in alphabetical order', () => {
	for (const file of ruleFiles) {
		const name = path.basename(file, '.js');
		assert.ok(eslintNodeTest.rules[name], `'${name}' is not exported in 'index.js'`);
		assert.ok(
			Object.hasOwn(eslintNodeTest.configs.all.rules, `node-test/${name}`),
			`'${name}' is not set in the all config`,
		);

		const documentationPath = path.join('docs/rules', `${name}.md`);
		const testPath = path.join('test', file);

		assert.ok(fs.existsSync(documentationPath), `There is no documentation for '${name}'`);
		assert.ok(fs.existsSync(testPath), `There are no tests for '${name}'`);
	}

	assert.strictEqual(
		Object.keys(eslintNodeTest.rules).length,
		ruleFiles.length,
		'There are more exported rules than rule files.',
	);

	for (const configName of ['recommended', 'unopinionated', 'all']) {
		assert.strictEqual(
			Object.keys(eslintNodeTest.configs[configName].rules).length,
			ruleFiles.length,
			`There are more rules than those in the ${configName} config.`,
		);
	}
});

test('validate configuration', async () => {
	const results = await Promise.all(Object.entries(eslintNodeTest.configs).map(async ([name, config]) => {
		const eslint = new ESLint({
			baseConfig: config,
			overrideConfigFile: true,
		});

		const result = await eslint.calculateConfigForFile('dummy.js');

		return {name, config, result};
	}));

	for (const {name, config, result} of results) {
		assert.deepStrictEqual(
			Object.keys(result.rules),
			Object.keys(config.rules),
			`Configuration for "${name}" is invalid.`,
		);
	}
});

test('Every rule has valid meta.type', () => {
	const validTypes = ['problem', 'suggestion', 'layout'];

	for (const file of ruleFiles) {
		const name = path.basename(file, '.js');
		const rule = eslintNodeTest.rules[name];

		assert.notStrictEqual(rule.meta, undefined, `${name} has no meta`);
		assert.notStrictEqual(rule.meta, null, `${name} has no meta`);
		assert.strictEqual(typeof rule.meta.type, 'string', `${name} meta.type is not string`);
		assert.ok(validTypes.includes(rule.meta.type), `${name} meta.type is not one of [${validTypes.join(', ')}]`);
	}
});

test('Every rule file has the appropriate contents', () => {
	for (const ruleFile of ruleFiles) {
		const ruleName = path.basename(ruleFile, '.js');
		const rulePath = path.join('rules', `${ruleName}.js`);
		const ruleContents = fs.readFileSync(rulePath, 'utf8');

		assert.ok(
			ruleContents.includes('/** @type {import(\'eslint\').Rule.RuleModule} */')
			|| ruleContents.includes('/** @type {ESLint.Rule.RuleModule} */'),
			`${ruleName} includes jsdoc comment for rule type`,
		);
	}
});

test('Every rule has a doc with the appropriate content', () => {
	for (const ruleFile of ruleFiles) {
		const ruleName = path.basename(ruleFile, '.js');
		const documentPath = path.join('docs/rules', `${ruleName}.md`);
		const documentContents = fs.readFileSync(documentPath, 'utf8');

		assert.ok(documentContents.includes('## Examples'), `${ruleName} includes '## Examples' examples section`);
	}
});

test('Plugin should have metadata', () => {
	assert.strictEqual(typeof eslintNodeTest.meta.name, 'string');
	assert.strictEqual(typeof eslintNodeTest.meta.version, 'string');
});

test('rule.meta.docs.recommended should be synchronized with presets', () => {
	for (const [name, rule] of Object.entries(eslintNodeTest.rules)) {
		const {recommended} = rule.meta.docs;
		assert.ok(typeof recommended === 'boolean' || recommended === 'unopinionated', `meta.docs.recommended in '${name}' rule should be a boolean or 'unopinionated'.`);

		const recommendedSeverity = eslintNodeTest.configs.recommended.rules[`node-test/${name}`];
		if (recommended) {
			assert.strictEqual(recommendedSeverity, 'error', `'${name}' rule should set to 'error'.`);
		} else {
			assert.strictEqual(recommendedSeverity, 'off', `'${name}' rule should set to 'off'.`);
		}

		const unopinionatedSeverity = eslintNodeTest.configs.unopinionated.rules[`node-test/${name}`];
		if (recommended === 'unopinionated') {
			assert.strictEqual(unopinionatedSeverity, 'error', `'${name}' rule should set to 'error' in the unopinionated config.`);
		} else {
			assert.strictEqual(unopinionatedSeverity, 'off', `'${name}' rule should set to 'off' in the unopinionated config.`);
		}
	}
});

test('deprecated rules should be disabled in presets', () => {
	for (const [name, rule] of Object.entries(eslintNodeTest.rules)) {
		if (!rule.meta.deprecated) {
			continue;
		}

		for (const config of Object.values(eslintNodeTest.configs)) {
			assert.strictEqual(config.rules[`node-test/${name}`], 'off');
		}
	}
});

test('Promise assertions are owned by no-unawaited-promise-assertion', async () => {
	const eslint = new ESLint({
		baseConfig: eslintNodeTest.configs.recommended,
		overrideConfigFile: true,
	});
	const source = [
		'import test from \'node:test\';',
		'import assert from \'node:assert/strict\';',
		'test(\'example\', () => {',
		'\tload().then(value => assert.ok(value));',
		'\tload().then(() => assert.fail()).catch(() => {});',
		'\tload().then(() => { assert.ok(value); throw error; });',
		'});',
	].join('\n');
	const [result] = await eslint.lintText(source);
	const promiseAssertionMessages = result.messages.filter(message => message.ruleId === 'node-test/no-unawaited-promise-assertion');
	const lateActivityMessages = result.messages.filter(message => message.ruleId === 'node-test/no-late-test-activity');

	assert.strictEqual(promiseAssertionMessages.length, 3);
	assert.strictEqual(lateActivityMessages.length, 1);
});

test('overlapping rules should not report a detached subtest twice', async () => {
	const eslint = new ESLint({
		baseConfig: eslintNodeTest.configs.recommended,
		overrideConfigFile: true,
	});
	const source = [
		'import test from \'node:test\';',
		'test(\'parent\', testContext => {',
		'\tsetTimeout(() => {',
		'\t\ttestContext.test(\'child\', () => {});',
		'\t});',
		'});',
	].join('\n');
	const [result] = await eslint.lintText(source);
	const lateActivityMessages = result.messages.filter(message => message.ruleId === 'node-test/no-late-test-activity');

	assert.strictEqual(lateActivityMessages.length, 1);
	assert.ok(result.messages.every(message => message.ruleId !== 'node-test/no-unawaited-subtest'));
});

test('overlapping rules should not report a detached Promise subtest twice', async () => {
	const eslint = new ESLint({
		baseConfig: eslintNodeTest.configs.recommended,
		overrideConfigFile: true,
	});
	const source = [
		'import test from \'node:test\';',
		'test(\'parent\', testContext => {',
		'\tload().then(() => {',
		'\t\ttestContext.test(\'child\', () => {});',
		'\t});',
		'});',
	].join('\n');
	const [result] = await eslint.lintText(source);
	const lateActivityMessages = result.messages.filter(message => message.ruleId === 'node-test/no-late-test-activity');

	assert.strictEqual(lateActivityMessages.length, 1);
	assert.ok(result.messages.every(message => message.ruleId !== 'node-test/no-unawaited-subtest'));
});
