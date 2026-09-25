import test from 'node:test';
import assert from 'node:assert/strict';
import {Linter} from 'eslint';
import {toEslintRules} from '../../rules/rule/index.js';

const messages = {problem: 'A problem.'};

// A one-off rule that reports the identifier `name` with whatever `create` returns, to test the
// adapter itself rather than any one rule.
// The same, with the meta a rule offering suggestions has to declare.
const withSuggestions = create => toEslintRules({
	rule: {
		create,
		meta: {
			type: 'problem',
			docs: {description: 'x', recommended: false},
			fixable: 'code',
			hasSuggestions: true,
			messages,
		},
	},
}).rule;

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

test('a suggestion list is converted whether it is an array, a generator, or a single suggestion', () => {
	const makeSuggestion = index => ({
		desc: `s${index}`,
		fix: (fixer, {abort}) => fixer.replaceTextRange([0, 1], 'z'),
	});
	function * suggestions() {
		yield makeSuggestion(1);
		yield makeSuggestion(2);
	}

	for (const [suggest, expected] of [
		[suggestions(), 2],
		[[...suggestions()], 2],
		[makeSuggestion(1), 1],
	]) {
		const rule = withSuggestions(context => context.on('Identifier', node => ({
			node,
			messageId: 'problem',
			suggest,
		})));

		const [message] = lint(rule, 'let a = 1;');
		assert.equal(message.suggestions.length, expected);
		assert.ok(message.suggestions.every(suggestion => suggestion.fix));
	}
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

test('a fix helper that stands down by returning undefined is dropped, not handed to ESLint', () => {
	// A plain fix that returns a helper's `undefined` on its own reports no fix.
	const standsDown = makeRule(reportWith('a', () => undefined));
	const [message] = lint(standsDown, 'let a = 1;');
	assert.equal(message.message, 'A problem.');
	assert.equal(message.fix, undefined);

	// Next to a real edit, the `undefined` would reach ESLint's `mergeFixes`, which reads `.range` off every entry.
	const withEdit = makeRule(reportWith('a', fixer => [undefined, fixer.replaceTextRange([0, 1], 'z')]));
	const [messageWithEdit] = lint(withEdit, 'let a = 1;');
	assert.deepEqual(messageWithEdit.fix, {range: [0, 1], text: 'z'});
});

test('a generator fix that yields undefined alongside real edits keeps the real edits', () => {
	const rule = makeRule(reportWith('a', function * (fixer) {
		yield undefined;
		yield fixer.replaceTextRange([0, 1], 'z');
	}));

	const [message] = lint(rule, 'let a = 1;');
	assert.deepEqual(message.fix, {range: [0, 1], text: 'z'});
});

test('a suggestion without a fix is dropped rather than crashing the run', () => {
	const rule = withSuggestions(context => context.on('Identifier', node => ({
		node,
		messageId: 'problem',
		suggest: {desc: 'no fix'},
	})));

	// The problem is still reported; ESLint drops the now-empty suggestion list.
	const [message] = lint(rule, 'let a = 1;');
	assert.equal(message.message, 'A problem.');
	assert.equal(message.suggestions, undefined);
});

test('a problem that happens to be iterable is still one problem', () => {
	const rule = makeRule(context => context.on('Identifier', node => (
		node.type === 'Identifier' && node.name === 'a'
			? {
				node,
				messageId: 'problem',
				* [Symbol.iterator]() {
					yield {node, messageId: 'problem'};
				},
			}
			: undefined
	)));

	const messages_ = lint(rule, 'let a = 1;');
	assert.equal(messages_.length, 1);
	assert.equal(messages_[0].message, 'A problem.');
});
