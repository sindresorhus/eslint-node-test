import test from 'node:test';
import assert from 'node:assert/strict';
import plugin from '../../index.js';
import SnapshotRuleTester, {visualizeEslintMessage} from '../utils/snapshot-rule-tester.js';
import {toEslintRules} from '../../rules/rule/index.js';

// A `test` stand-in that records the cases instead of registering them, so a bad option can be asserted on without touching the real runner. The recorded body still runs, with a stub `t.assert.snapshot`, so a harness that throws while running a case is caught here rather than passing for the wrong reason.
const collect = () => {
	const cases = [];
	const snapshots = [];
	const record = (name, body) => {
		const testCase = {name, body};
		cases.push(testCase);
		try {
			body({
				assert: {
					snapshot(value) {
						snapshots.push(value);
					},
				},
			});
		} catch (error) {
			testCase.threw = error;
		}
	};

	record.only = record;
	return {record, cases, snapshots};
};

const runWithTests = (tests, testerOptions) => {
	const {record, cases, snapshots} = collect();
	const tester = new SnapshotRuleTester(record, testerOptions);
	tester.run('no-only-test', plugin.rules['no-only-test'], tests);
	return {cases, snapshots};
};

// A rule that reports the filename the linter resolved the file to, so a filename the harness drops is visible in the snapshot it produced.
const filenameRule = {
	create(context) {
		context.on('Program', node => ({
			node,
			message: 'Filename: ' + context.filename,
		}));
	},
	meta: {
		type: 'problem',
		messages: {},
		schema: [],
		languages: ['js/js'],
	},
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
	const {cases} = runWithTests(
		{
			valid: [],
			invalid: ['import test from "node:test";\ntest.only("a", () => {});'],
		},
		{filename: 'with-options.test.js'},
	);

	assert.strictEqual(cases.length, 1);
	assert.strictEqual(cases[0].threw, undefined);
});

test('A testerOptions filename reaches the linter, and a case filename overrides it', () => {
	const tests = {
		valid: [],
		invalid: [
			'import test from "node:test";',
			{code: 'import test from "node:test";', filename: 'case.test.js'},
		],
	};

	const {snapshots} = collectRunner(filenameRule, tests, {filename: 'tester.test.js'});
	// A reported message is snapshotted twice, once as text and once in a code frame, so the filenames are read as a set in the order the cases ran.
	const filenames = [...new Set(snapshots
		.map(snapshot => /Filename: (\S+)/.exec(snapshot)?.[1])
		.filter(Boolean))];
	assert.deepStrictEqual(filenames, ['tester.test.js', 'case.test.js']);
});

function collectRunner(rule, tests, testerOptions) {
	const {record, snapshots} = collect();
	const tester = new SnapshotRuleTester(record, testerOptions);
	// The tester lints with the plugin's own adapter, as the plugin entry does.
	tester.run('filename-rule', toEslintRules({'filename-rule': rule})['filename-rule'], tests);
	return {snapshots};
}
