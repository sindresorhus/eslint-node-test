import test from 'node:test';
import assert from 'node:assert/strict';
import plugin from '../../index.js';
import SnapshotRuleTester, {visualizeEslintMessage} from '../utils/snapshot-rule-tester.js';

// A `test` stand-in that records the cases instead of running them, so a bad option can be
// asserted on without registering real tests.
const collect = () => {
	const cases = [];
	const record = (name, body) => {
		cases.push({name, body});
	};
	record.only = record;
	return {record, cases};
};

const runWithTests = tests => {
	const {record, cases} = collect();
	const tester = new SnapshotRuleTester(record, {});
	tester.run('no-only-test', plugin.rules['no-only-test'], tests);
	return cases;
};

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

test('The tester rejects an unknown top-level option', () => {
	assert.throws(() => {
		runWithTests({valid: [], invalid: ['import test from "node:test";'], testerOption: {}});
	}, /Unexpected snapshot test properties: testerOption/);
});

test('The tester accepts testerOptions', () => {
	const cases = runWithTests({
		valid: [],
		invalid: ['import test from "node:test";'],
		testerOptions: {filename: 'with-options.test.js'},
	});

	assert.strictEqual(cases.length, 1);
});
