import {getTester} from './utils/test.js';

const {test} = getTester(import.meta);

const setup = 'import {test, it, describe, suite} from \'node:test\';\n';
const withSetup = code => setup + code;

test.snapshot({
	valid: [
		// Static title outside any loop
		withSetup('it(\'a\', () => {});'),

		// Loop, but the title interpolates the loop variable
		// eslint-disable-next-line no-template-curly-in-string
		withSetup('for (const x of xs) { it(`case ${x}`, () => {}); }'),

		// Loop, title is the loop variable itself
		withSetup('for (const name of names) { it(name, () => {}); }'),

		// Iteration callback with an interpolated title
		// eslint-disable-next-line no-template-curly-in-string
		withSetup('xs.map(x => it(`t ${x}`, () => {}));'),

		// Static inner title scoped under a dynamic describe — unique per suite
		withSetup('for (const x of xs) { describe(x, () => { it(\'static\', () => {}); }); }'),
		withSetup('xs.forEach(x => describe(x, () => { it(\'static\', () => {}); }));'),

		// Test defined in a helper that a loop happens to call (lexically outside the loop)
		withSetup('for (const x of xs) { generate(); }\nfunction generate() { it(\'static\', () => {}); }'),

		// Not a test file
		'for (const x of xs) { it(\'static\', () => {}); }',
	],
	invalid: [
		// For-of with a static string title
		withSetup('for (const x of xs) { it(\'static\', () => {}); }'),

		// Classic for loop
		withSetup('for (let i = 0; i < 3; i++) { test(\'static\', () => {}); }'),

		// While loop
		withSetup('while (condition) { it(\'static\', () => {}); }'),

		// Do-while loop
		withSetup('do { it(\'static\', () => {}); } while (condition);'),

		// For-in loop
		withSetup('for (const key in obj) { it(\'static\', () => {}); }'),

		// `forEach` callback
		withSetup('xs.forEach(x => it(\'static\', () => {}));'),

		// `map` callback
		withSetup('xs.map((x, index) => it(\'static\', () => {}));'),

		// `flatMap` callback
		withSetup('xs.flatMap(x => it(\'static\', () => {}));'),

		// `describe`/suite in a loop
		withSetup('for (const x of xs) { describe(\'suite\', () => {}); }'),

		// Static template literal (no interpolation)
		withSetup('for (const x of xs) { it(`static`, () => {}); }'),

		// Title resolved from a constant
		withSetup('const NAME = \'x\';\nfor (const x of xs) { it(NAME, () => {}); }'),

		// Nested loops
		withSetup('for (const x of xs) { for (const y of ys) { it(\'static\', () => {}); } }'),

		// Namespace import
		'import * as nodeTest from \'node:test\';\nfor (const x of xs) { nodeTest.it(\'static\', () => {}); }',
	],
});
