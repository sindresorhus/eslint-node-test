import test from 'node:test';
import assert from 'node:assert/strict';
import {Linter} from 'eslint';
import isConditionalBranch from '../../rules/utils/is-conditional-branch.js';

const linter = new Linter();
let programNode;
const config = {
	languageOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
	},
	plugins: {
		test: {
			rules: {
				capture: {
					create: () => ({
						Program(node) {
							programNode = node;
						},
					}),
				},
			},
		},
	},
	rules: {
		'test/capture': 'error',
	},
};

function parse(code) {
	programNode = undefined;
	linter.verify(code, config);
	return programNode;
}

test('`if`/ternary: consequent and alternate are conditional, the test is not', () => {
	const ifStatement = parse('if (a) b; else c;').body[0];
	assert.ok(isConditionalBranch(ifStatement, ifStatement.consequent));
	assert.ok(isConditionalBranch(ifStatement, ifStatement.alternate));
	assert.ok(!isConditionalBranch(ifStatement, ifStatement.test));

	const ternary = parse('const x = a ? b : c;').body[0].declarations[0].init;
	assert.ok(isConditionalBranch(ternary, ternary.consequent));
	assert.ok(isConditionalBranch(ternary, ternary.alternate));
	assert.ok(!isConditionalBranch(ternary, ternary.test));
});

test('logical expression: only the right-hand side is conditional', () => {
	for (const code of ['a && b;', 'a || b;', 'a ?? b;']) {
		const logical = parse(code).body[0].expression;
		assert.ok(isConditionalBranch(logical, logical.right));
		assert.ok(!isConditionalBranch(logical, logical.left));
	}
});

test('switch case: the body is conditional, the case test is not', () => {
	const switchCase = parse('switch (x) { case 1: foo(); break; }').body[0].cases[0];
	assert.ok(isConditionalBranch(switchCase, switchCase.consequent[0]));
	assert.ok(!isConditionalBranch(switchCase, switchCase.test));
});

test('loop bodies only count when `includeLoops` is set', () => {
	for (const code of [
		'while (c) body();',
		'do body(); while (c);',
		'for (;;) body();',
		'for (const x of y) body();',
		'for (const k in o) body();',
	]) {
		const loop = parse(code).body[0];
		assert.ok(!isConditionalBranch(loop, loop.body));
		assert.ok(isConditionalBranch(loop, loop.body, {includeLoops: true}));
	}
});

test('non-conditional constructs are never a branch', () => {
	const block = parse('{ foo(); }').body[0];
	assert.ok(!isConditionalBranch(block, block.body[0]));
});
