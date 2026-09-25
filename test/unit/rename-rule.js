import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceRuleIdInRulesIndex, replaceRuleName, sortReadmeRuleRows} from '../../scripts/rename-rule.js';

test('replaceRuleIdInRulesIndex only rewrites the exact export', () => {
	const input = [
		'export {default as \'prefer-array-flat-map\'} from \'./prefer-array-flat-map.js\';',
		'export {default as \'prefer-array-flat\'} from \'./prefer-array-flat.js\';',
	].join('\n');

	assert.strictEqual(
		replaceRuleIdInRulesIndex(input, 'prefer-array-flat', 'renamed-rule'),
		[
			'export {default as \'prefer-array-flat-map\'} from \'./prefer-array-flat-map.js\';',
			'export {default as \'renamed-rule\'} from \'./renamed-rule.js\';',
		].join('\n'),
	);
});

test('sortReadmeRuleRows keeps the renamed row inside the rules table', () => {
	const input = [
		'# eslint-node-test',
		'',
		'<!-- begin auto-generated rules list -->',
		'',
		'| Name | Description |',
		'| :--- | :--- |',
		'| [alpha-rule](docs/rules/alpha-rule.md) | Alpha |',
		'| [zzz-rule](docs/rules/zzz-rule.md) | Throw |',
		'<!-- end auto-generated rules list -->',
		'',
		'## FAQ',
	].join('\n');

	assert.strictEqual(
		sortReadmeRuleRows(input, 'zzz-rule'),
		[
			'# eslint-node-test',
			'',
			'<!-- begin auto-generated rules list -->',
			'',
			'| Name | Description |',
			'| :--- | :--- |',
			'| [alpha-rule](docs/rules/alpha-rule.md) | Alpha |',
			'| [zzz-rule](docs/rules/zzz-rule.md) | Throw |',
			'<!-- end auto-generated rules list -->',
			'',
			'## FAQ',
		].join('\n'),
	);
});

test('replaceRuleName only rewrites the exact rule name', () => {
	const input = [
		'| [test-title](docs/rules/test-title.md) | One |',
		'| [test-title-format](docs/rules/test-title-format.md) | Two |',
		'\'node-test/test-title\': \'error\',',
		'\'node-test/test-title-format\': \'error\',',
		'`test-title`: bad example',
		'`test-title-format`: good example',
		'file test-title.js.snapshot',
	].join('\n');

	assert.strictEqual(
		replaceRuleName(input, 'test-title', 'renamed-rule'),
		[
			'| [renamed-rule](docs/rules/renamed-rule.md) | One |',
			'| [test-title-format](docs/rules/test-title-format.md) | Two |',
			'\'node-test/renamed-rule\': \'error\',',
			'\'node-test/test-title-format\': \'error\',',
			'`renamed-rule`: bad example',
			'`test-title-format`: good example',
			'file renamed-rule.js.snapshot',
		].join('\n'),
	);
});
