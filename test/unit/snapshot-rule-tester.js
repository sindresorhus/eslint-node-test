import test from 'node:test';
import assert from 'node:assert/strict';
import {visualizeEslintMessage} from '../utils/snapshot-rule-tester.js';

test('Snapshot formatter includes diagnostic location', () => {
	const code = [
		'first();',
		'second();',
	].join('\n');

	assert.strictEqual(
		visualizeEslintMessage(code, {
			line: 2,
			column: 1,
			endLine: 2,
			endColumn: 7,
			message: 'Problem.',
		}),
		[
			'  1 | first();',
			'> 2 | second();',
			'    | ^^^^^^ Problem.',
		].join('\n'),
	);
});

test('Snapshot formatter changes when diagnostic location moves', () => {
	const code = [
		'first();',
		'second();',
	].join('\n');

	assert.notStrictEqual(
		visualizeEslintMessage(code, {
			line: 1,
			column: 1,
			message: 'Problem.',
		}),
		visualizeEslintMessage(code, {
			line: 2,
			column: 1,
			message: 'Problem.',
		}),
	);
});
