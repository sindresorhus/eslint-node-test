import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withTest = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Reason strings provided
		withTest('test(\'t\', {skip: \'work in progress\'}, () => {});'),
		withTest('test(\'t\', {todo: \'implement later\'}, () => {});'),
		withTest('test(\'t\', t => { t.skip(\'not ready\'); });'),
		withTest('test(\'t\', t => { t.todo(\'pending\'); });'),

		// Chained modifier — no inline reason mechanism, out of scope
		withTest('test.skip(\'t\', () => {});'),

		// Dynamic skip value — cannot require a literal reason
		withTest('test(\'t\', {skip: shouldSkip}, () => {});'),

		// Not a test file
		'test(\'t\', {skip: true}, () => {});',

		// A reason is honored in a hook context just like in a test body
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.skip(\'flaky\'); t.todo(\'wip\'); });',

		// A local variable shadowing the context name is not the test context
		withTest('test(\'outer\', t => { function helper() { const t = {skip() {}}; t.skip(); } });'),

		// A hook callback shadowing the context name is not the test context either
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { function helper() { const t = {skip() {}}; t.skip(); } });',

		// A hook's options carry no modifier, so an inert `{skip: true}` there is an unknown key
		'import {beforeEach} from \'node:test\';\nbeforeEach(() => {}, {skip: true});',
	],
	invalid: [
		// A `getTestContext()` under any local alias is named by the local name
		'import {test, getTestContext as gtc} from \'node:test\';\ntest(\'a\', () => { gtc().skip(); });',
		// `{skip: true}` / `{todo: true}`
		withTest('test(\'t\', {skip: true}, () => {});'),
		withTest('test(\'t\', {todo: true}, () => {});'),

		// Context methods with no message
		withTest('test(\'t\', t => { t.skip(); });'),
		withTest('test(\'t\', t => { t.todo(); });'),

		// Hook contexts expose the same `t.skip()` / `t.todo()` methods as a test context
		'import {before} from \'node:test\';\nbefore(t => { t.skip(); });',
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.todo(); });',
		'import {after} from \'node:test\';\nafter(t => { t.skip(); });',
		'import {afterEach} from \'node:test\';\nafterEach(t => { t.todo(); });',
		'import test from \'node:test\';\ntest.beforeEach(t => { t.skip(); });',
		'import test, {before} from \'node:test\';\nbefore(function (t) { t.todo(); });',

		// Suite with `{skip: true}`
		'import {describe} from \'node:test\';\ndescribe(\'s\', {skip: true}, () => {});',

		// A TypeScript-wrapped `true` still counts as `true`
		{
			code: withTest('test(\'t\', {skip: true as boolean}, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'a\', {skip: true}, () => {}); });',
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'a\', {todo: true}, () => {}); });',

		// `getTestContext()` returns the same test context, and a TypeScript wrapper on the
		// receiver must not hide the call
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', () => { getTestContext().skip(); });',
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', () => { getTestContext().todo(); });',
		{
			code: 'import {test} from \'node:test\';\ntest(\'a\', t => { t!.skip(); });',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import {test} from \'node:test\';\ntest(\'a\', t => { (t as TestContext).todo(); });',
			languageOptions: {parser: parsers.typescript},
		},
		// The `getTestContext` a default or namespace import carries is named as the file writes it
		'import test from \'node:test\';\ntest(\'a\', () => { test.getTestContext().skip(); });',
		'import * as nt from \'node:test\';\nnt.test(\'a\', () => { nt.getTestContext().todo(); });',
	],
});
