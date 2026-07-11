import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withStrictAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withNamespaceAssert = code => `import * as assert from 'node:assert';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;
const withNamedStrictImport = (methods, code) => `import {${methods}} from 'node:assert/strict';\n${code}`;
const withTest = code => `import test from 'node:test';\n${code}`;
const withNamespaceTest = code => `import * as nodeTest from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import
		'assert.rejects(async () => await operation());',

		// Unrelated or shadowed calls
		withAssert('custom.rejects(async () => await operation());'),
		withAssert('function helper(assert) { assert.rejects(async () => await operation()); }'),
		withNamespaceAssert('function helper(assert) { assert.rejects(async () => await operation()); }'),
		withNamedImport('rejects', 'function helper(rejects) { rejects(async () => await operation()); }'),
		withTest('test(\'test\', context => { custom.assert.rejects(async () => await operation()); });'),
		withTest('test(\'test\', context => { { const context = custom; context.assert.rejects(async () => await operation()); } });'),
		withNamespaceTest('function helper(nodeTest) { nodeTest.test(\'test\', context => { context.assert.rejects(async () => await operation()); }); }'),

		// Only parameterless async identity callbacks are targeted
		withAssert('assert.rejects(() => operation());'),
		withAssert('assert.rejects(async value => await operation(value));'),
		withAssert('assert.rejects(async function * () { await operation(); });'),
		withAssert('assert.rejects(async () => operation());'),
		withAssert('assert.rejects(async () => { return operation(); });'),
		withAssert('assert.rejects(async () => { setup(); await operation(); });'),
		withAssert('assert.rejects(async () => { try { await operation(); } catch {} });'),
		withAssert('assert.rejects(async () => await await operation());'),
		withAssert('assert.rejects(async () => await (condition ? await first() : second()));'),
		withAssert('assert.rejects(async () => { await await operation(); });'),
		withAssert('assert.rejects(async () => { return await await operation(); });'),
		withAssert('assert.rejects(callback);'),
		withAssert('assert.rejects(...callbacks);'),
		{
			code: withAssert('assert.rejects(async <Value>() => await operation<Value>());'),
			languageOptions: {parser: parsers.typescript},
		},

		// Other assertion forms are unaffected
		withAssert('assert.doesNotReject(async () => await operation());'),
		withAssert('assert.throws(async () => await operation());'),
		withAssert('assert[\'rejects\'](async () => await operation());'),
	],
	invalid: [
		withAssert('assert.rejects(async () => await operation());'),
		withAssert('assert.rejects(async () => { await operation(); });'),
		withAssert('assert.rejects(async () => { return await operation(); });'),
		withAssert('assert.rejects(async function () { await operation(); });'),
		withAssert('assert.rejects(async function () { return await operation(); });'),
		withAssert('assert.rejects(async function operationCallback() { return await operation(); });'),
		withAssert('assert.rejects((async () => await operation()));'),
		withStrictAssert('assert.rejects(async () => await operation());'),
		withNamespaceAssert('assert.rejects(async () => await operation());'),
		withAssert('assert.strict.rejects(async () => await operation());'),
		withNamespaceAssert('assert.strict.rejects(async () => await operation());'),
		withNamedImport('rejects', 'rejects(async () => await operation());'),
		withNamedImport('rejects as assertRejects', 'assertRejects(async () => await operation());'),
		withNamedImport('strict as strictAssert', 'strictAssert.rejects(async () => await operation());'),
		withNamedStrictImport('rejects', 'rejects(async () => await operation());'),
		'import {rejects} from \'assert\';\nrejects(async () => await operation());',
		'import assert from \'assert/strict\';\nassert.rejects(async () => await operation());',
		withAssert('assert?.rejects(async () => await operation());'),
		withAssert('assert.rejects?.(async () => await operation());'),
		withAssert('assert.rejects(async () => await operation()?.result);'),
		withAssert('assert.rejects(async () => await (operation()));'),
		withAssert('assert.rejects(async () => await operation().then(value => value));'),
		withAssert('assert.rejects(async () => await (async () => await operation())());'),
		withTest('test(\'test\', context => { context.assert.rejects(async () => await operation()); });'),
		withTest('test.only(\'test\', context => { context.assert.rejects(async () => await operation()); });'),
		withNamespaceTest('nodeTest.test(\'test\', context => { context.assert.rejects(async () => await operation()); });'),
		withTest('test(\'outer\', context => { context.test(\'inner\', nestedContext => { nestedContext.assert.rejects(async () => await operation()); }); });'),
		'import {beforeEach} from \'node:test\';\nbeforeEach(context => { context.assert.rejects(async () => await operation()); });',
		withTest('test.beforeEach(context => { context.assert.rejects(async () => await operation()); });'),
		withAssert('assert.rejects(async /* keep */ () => await operation());'),
		withAssert('assert.rejects(async () => await /* keep */ operation());'),
		withAssert('assert.rejects(async () => await operation(/* keep */));'),
		withAssert('assert.rejects(async () => { await /* keep */ operation(); });'),
		withAssert('assert.rejects(async () => { await\noperation(); });'),
		withAssert('assert.rejects(async () => { await // Keep this comment.\noperation(); });'),
		withAssert('assert.rejects(async () => { ((await operation())); });'),
		withAssert('assert.rejects(async () => { return (await operation()); });'),
		withAssert('assert.rejects(async () => { return /* keep */ await operation(); });'),
		{
			code: withAssert('assert.rejects(async () => await (operation() as Promise<void>));'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.rejects(async () => await operation()!);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.rejects(async () => await (operation() satisfies Promise<void>));'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.rejects(async () => (await operation()) as Promise<void>);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.rejects(async () => (await operation())!);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.rejects(async () => (await operation()) satisfies Promise<void>);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.rejects(async () => { return (await operation()) as Promise<void>; });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.rejects(async () => { await operation() as Promise<void>; });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.rejects(async (): Promise<void> => await operation());'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.rejects(async () => await (<Promise<void>>operation()));'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.rejects(((async () => await operation()) as () => Promise<void>)!);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.rejects((async () => await operation()) satisfies () => Promise<void>);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.rejects(async function (): Promise<void> { return await operation(); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});
