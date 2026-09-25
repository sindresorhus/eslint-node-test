import fs, {promises as fsAsync} from 'node:fs';
import path from 'node:path';
import test, {before} from 'node:test';
import assert from 'node:assert/strict';
import {defineConfig} from 'eslint/config';
import {ESLint} from 'eslint';
import eslintNodeTest from '../index.js';

const nodeTest = eslintNodeTest;

let ruleFiles;

before(async () => {
	const files = await fsAsync.readdir('rules');
	ruleFiles = files.filter(file => path.extname(file) === '.js' && path.basename(file) !== 'index.js');
});

test('Every rule is defined in index file in alphabetical order', async () => {
	// Read the file, not the namespace it is imported as: an ES module namespace object sorts its
	// own keys, so `Object.keys(…)` is in order whatever the file says and the check cannot fail.
	const source = await fsAsync.readFile('rules/index.js', 'utf8');
	const declaredNames = Array.from(source.matchAll(/^export \{default as '(.+?)'\}/gm), match => match[1]);
	assert.ok(declaredNames.length > 0, 'No rules were found in rules/index.js');
	// The generator sorts the file names, extension included, so that is the order to check against.
	// A locale-aware sort of the bare rule names is a different one: it puts `test-title` before
	// `test-title-format`, where the generator puts the longer name first.
	const expectedNames = ruleFiles
		.toSorted((first, second) => first.localeCompare(second))
		.map(file => path.basename(file, '.js'));
	assert.deepStrictEqual(declaredNames, expectedNames, 'The rules are not exported in alphabetical order.');
	// Compared as sets, not in order: the file's order is the generator's, not a locale-aware one.
	assert.deepStrictEqual(
		declaredNames.toSorted((first, second) => first.localeCompare(second)),
		Object.keys(eslintNodeTest.rules).toSorted((first, second) => first.localeCompare(second)),
		'rules/index.js does not export exactly the rules the plugin exposes.',
	);

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

test('recommended config works through extends', async () => {
	const eslint = new ESLint({
		baseConfig: defineConfig([
			{
				files: ['**/*.js'],
				plugins: {
					'node-test': nodeTest,
				},
				extends: ['node-test/recommended'],
			},
		]),
		overrideConfigFile: true,
	});
	const [result] = await eslint.lintText('import test from \'node:test\'; test.only(\'title\', () => {});', {filePath: 'example.js'});
	assert.ok(result.messages.some(message => message.ruleId === 'node-test/no-only-test'));

	const configForCjsFile = await eslint.calculateConfigForFile('example.cjs');
	assert.strictEqual(configForCjsFile?.rules?.['node-test/no-only-test'], undefined);

	const eslintWithOverrides = new ESLint({
		baseConfig: defineConfig([
			{
				files: ['**/*.js'],
				plugins: {
					'node-test': nodeTest,
				},
				extends: ['node-test/recommended'],
				rules: {'node-test/no-only-test': 'off'},
			},
		]),
		overrideConfigFile: true,
	});
	const [overriddenResult] = await eslintWithOverrides.lintText('import test from \'node:test\'; test.only(\'title\', () => {});', {filePath: 'example.js'});
	assert.ok(overriddenResult.messages.every(message => message.ruleId !== 'node-test/no-only-test'));
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

test('No rule test narrows itself to one case', async () => {
	// A narrowed case runs alone and the runner does not even count the rest as skipped, so the file
	// would go green with almost nothing covered. The tester's `test.only(…)` is a case in the `valid` or `invalid` list, so it starts its own line, whatever it takes: a tagged template, a string, a case object, or a helper call such as `withTest('…')`. A `test.only` in test data sits inside a string after other code on its line, a subtest's `t.test.only` follows a dot, and a mention in a comment follows the comment marker.
	const files = await fsAsync.readdir('test');
	const sources = await Promise.all(
		files
			.filter(file => file.endsWith('.js'))
			.map(async file => [file, await fsAsync.readFile(path.join('test', file), 'utf8')]),
	);
	for (const [file, source] of sources) {
		assert.doesNotMatch(source, /^[\t ]*test\.only\b/m, `'test/${file}' narrows a case, so its other cases never run`);
		// A case's own `only` is a property on its own line, where `{only: true}` in test data is
		// always inside a string.
		assert.doesNotMatch(source, /^\t+only: true,?$/m, `'test/${file}' marks a case as the only one, so its other cases never run`);
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

		const allSeverity = eslintNodeTest.configs.all.rules[`node-test/${name}`];
		assert.strictEqual(
			allSeverity,
			rule.meta.deprecated ? 'off' : 'error',
			`'${name}' rule should set to '${rule.meta.deprecated ? 'off' : 'error'}' in the all config.`,
		);
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
