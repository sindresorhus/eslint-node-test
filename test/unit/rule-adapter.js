import test from 'node:test';
import assert from 'node:assert/strict';
import {Linter} from 'eslint';
import {toEslintRules} from '../../rules/rule/index.js';

const messages = {problem: 'A problem.'};

// A one-off rule that reports the identifier `name` with whatever `create` returns, to test the
// adapter itself rather than any one rule.
const makeRule = create => toEslintRules({
	rule: {
		create,
		meta: {
			type: 'problem',
			docs: {description: 'x', recommended: false},
			fixable: 'code',
			messages,
		},
	},
}).rule;

const lint = (rule, code) => new Linter().verify(code, {
	files: ['**'],
	plugins: {t: {rules: {rule}}},
	rules: {'t/rule': 'error'},
	languageOptions: {ecmaVersion: 'latest', sourceType: 'module'},
}, {filename: 'file.js'});

// A listener that reports `name` with an extra `fix` (or generator fix) attached.
const reportWith = (name, fix) => context => context.on('Identifier', node => {
	if (node.type !== 'Identifier' || node.name !== name) {
		return;
	}

	return {node, messageId: 'problem', ...(fix && {fix: (fixer, options) => fix(fixer, options, node)})};
});

test('abort() in a plain fix reports the problem without a fix', () => {
	const rule = makeRule(reportWith('a', (fixer, {abort}) => {
		abort();
	}));

	const [message] = lint(rule, 'let a = 1;');
	assert.equal(message.message, 'A problem.');
	assert.equal(message.fix, undefined);
});

test('abort() in a generator fix reports the problem without a fix', () => {
	const rule = makeRule(reportWith('a', function * (fixer, {abort}) {
		yield fixer.removeRange([0, 0]);
		abort();
	}));

	const [message] = lint(rule, 'let a = 1;');
	assert.equal(message.message, 'A problem.');
	assert.equal(message.fix, undefined);
});

test('a fix that throws another error still surfaces it', () => {
	const rule = makeRule(reportWith('a', () => {
		throw new Error('boom');
	}));

	assert.throws(() => {
		lint(rule, 'let a = 1;');
	}, /boom/);
});

test('a fix returns its edits', () => {
	const rule = makeRule(reportWith('a', (fixer, {abort}, node) => fixer.replaceText(node, 'b')));

	const [message] = lint(rule, 'let a = 1;');
	assert.deepEqual(message.fix, {range: [4, 5], text: 'b'});
});

test('a listener reports every problem it returns', () => {
	const rule = makeRule(context => context.on('Identifier', node => (
		node.type === 'Identifier' && node.name !== 'b'
			? [{node, messageId: 'problem'}, {node, messageId: 'problem'}]
			: undefined
	)));

	const messages_ = lint(rule, 'let a = 1, c = 2;');
	assert.equal(messages_.length, 4);
});
