import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceRuleIdInRulesIndex, sortReadmeRuleRows} from '../../scripts/rename-rule.js';

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
		'# eslint-plugin-unicorn',
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
			'# eslint-plugin-unicorn',
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
