import {getTester} from './utils/test.js';

const {test} = getTester(import.meta);

const inTest = code => `import test from 'node:test';\ntest('t', async t => {\n\t${code}\n});`;

test.snapshot({
	valid: [
		// Correctly awaited via Promise.all
		inTest('await Promise.all(xs.map(x => t.test(x, () => {})));'),
		inTest('await Promise.allSettled(xs.map(x => t.test(x, () => {})));'),

		// Returned `Promise.all` (consumed by the caller)
		inTest('return Promise.all(xs.map(x => t.test(x, () => {})));'),

		// Assigned `Promise.all` (consumed, presumably awaited later)
		inTest('const all = Promise.all(xs.map(x => t.test(x, () => {})));'),

		// Sequential for-of with await (each subtest awaited)
		inTest('for (const x of xs) { await t.test(x, () => {}); }'),

		// Iteration without any subtest
		inTest('const doubled = xs.map(x => x * 2);'),
		inTest('xs.forEach(x => process(x));'),

		// Bare-statement subtest in an iteration callback — covered by `no-unawaited-subtest`
		inTest('xs.forEach(x => { t.test(x, () => {}); });'),

		// Not a test file
		'xs.map(x => something(x));',
	],
	invalid: [
		// `map` with an expression-body subtest, not awaited
		inTest('xs.map(x => t.test(x, () => {}));'),

		// `map` returning a subtest, not awaited
		inTest('xs.map(x => { return t.test(x, () => {}); });'),

		// Awaiting the array itself does not await the subtests
		inTest('await xs.map(x => t.test(x, () => {}));'),

		// `Promise.all` wrapping but left as a floating bare statement (never awaited or returned)
		inTest('Promise.all(xs.map(x => t.test(x, () => {})));'),

		// `Promise.all` wrapping but explicitly discarded with `void`
		inTest('void Promise.all(xs.map(x => t.test(x, () => {})));'),

		// `forEach` — discards the subtest promises entirely
		inTest('xs.forEach(x => t.test(x, () => {}));'),

		// `forEach` with an async callback that awaits internally — still floats
		inTest('xs.forEach(async x => { await t.test(x, () => {}); });'),

		// `flatMap`
		inTest('xs.flatMap(x => t.test(x, () => {}));'),
	],
});
