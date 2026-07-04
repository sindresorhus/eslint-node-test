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

		// A local variable shadowing the context name is not the test context
		withTest('test(\'outer\', t => { function helper() { const t = {skip() {}}; t.skip(); } });'),
	],
	invalid: [
		// `{skip: true}` / `{todo: true}`
		withTest('test(\'t\', {skip: true}, () => {});'),
		withTest('test(\'t\', {todo: true}, () => {});'),

		// Context methods with no message
		withTest('test(\'t\', t => { t.skip(); });'),
		withTest('test(\'t\', t => { t.todo(); });'),

		// Suite with `{skip: true}`
		'import {describe} from \'node:test\';\ndescribe(\'s\', {skip: true}, () => {});',

		// A TypeScript-wrapped `true` still counts as `true`
		{
			code: withTest('test(\'t\', {skip: true as boolean}, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});
