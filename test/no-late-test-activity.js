import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test from 'node:test';\nimport assert from 'node:assert/strict';\n${code}`;
const inTest = code => withImport(`test('example', () => {\n\t${code}\n});`);
const inAsyncTest = code => withImport(`test('example', async () => {\n\t${code}\n});`);

test.snapshot({
	valid: [
		'import assert from \'node:assert/strict\';\nsetTimeout(() => assert.ok(value));',
		inTest('setTimeout(() => handle(value));'),
		inTest('setImmediate(externalCallback);'),
		inTest('queueMicrotask(() => { const check = () => assert.ok(value); check(); });'),
		inAsyncTest('await load().then(value => assert.ok(value));'),
		inTest('return load().catch(error => assert.ifError(error));'),
		inTest('const promise = load().finally(() => assert.ok(cleanedUp));'),
		inAsyncTest('await new Promise(resolve => { setTimeout(() => { assert.ok(value); resolve(); }, 10); });'),
		inTest('return new Promise(resolve => { setImmediate(() => { assert.ok(value); resolve(); }); });'),
		inTest('const promise = new Promise(resolve => { queueMicrotask(() => { assert.ok(value); resolve(); }); });'),
		withImport('test(\'example\', t => {\n\tt.plan(1, {wait: 100});\n\tsetTimeout(() => t.assert.ok(value), 10);\n});'),
		withImport('test(\'example\', t => {\n\tconst shouldWait = true;\n\tt.plan(1, {wait: shouldWait});\n\tsetTimeout(() => t.assert.ok(value), 10);\n});'),
		{
			code: withImport('test(\'example\', t => {\n\tt.plan(1, ({wait: true} as const));\n\tsetTimeout(() => t.assert.ok(value), 10);\n});'),
			languageOptions: {parser: parsers.typescript},
		},
		withImport('test(\'example\', t => {\n\tt.plan(1, {wait: 100});\n\tload().then(() => t.assert.ok(value));\n});'),
		withImport('test(\'example\', t => {\n\tt.plan(1, {wait: true});\n\tqueueMicrotask(() => t.test(\'child\', () => {}));\n});'),
		inTest('function setTimeout(callback) { callback(); }\n\tsetTimeout(() => assert.ok(value));'),
		inTest('const queueMicrotask = callback => callback();\n\tqueueMicrotask(() => { throw error; });'),
		withImport('describe(\'suite\', () => { setTimeout(() => assert.ok(value)); });'),
		inTest('timers.setTimeout(() => assert.ok(value));'),
		inTest('promise[method](() => assert.ok(value));'),
		inTest('new Promise(resolve => { function schedule() { setTimeout(() => assert.ok(value)); } });'),
		withImport('test(\'example\', (t, done) => { setTimeout(() => { assert.ok(value); done(); }); });'),
		withImport('test(\'example\', (t, done) => { setTimeout(() => assert.ok(value)); done(); });'),
		'import {beforeEach} from \'node:test\';\nimport assert from \'node:assert/strict\';\nbeforeEach((t, done) => { setImmediate(() => { assert.ok(value); done(); }); });',
		inTest('setTimeout(() => { try { throw error; } catch {} });'),
		inTest('load().then(() => { try { throw error; } catch {} });'),
		inTest('setTimeout(() => { try { assert.ok(value); } catch {} });'),
		inTest('load().then(() => { try { assert.ok(value); } catch {} });'),
	],
	invalid: [
		inTest('setTimeout(() => assert.ok(value), 10);'),
		inTest('setImmediate(() => { throw new Error(\'late\'); });'),
		inTest('queueMicrotask(() => assert.equal(value, 1));'),
		withImport('test(\'parent\', t => {\n\tsetTimeout(() => t.test(\'child\', () => {}), 10);\n});'),
		withImport('test(\'parent\', t => {\n\tsetTimeout(() => { t.test(\'child\', () => {}); }, 10);\n});'),
		withImport('test(\'example\', t => {\n\tsetImmediate(() => t.assert.ok(value));\n});'),
		withImport('test(\'example\', t => {\n\tt.plan(1, {wait: false});\n\tsetTimeout(() => t.assert.ok(value), 10);\n});'),
		withImport('test(\'example\', t => {\n\tconst shouldWait = false;\n\tt.plan(1, {wait: shouldWait});\n\tsetTimeout(() => t.assert.ok(value), 10);\n});'),
		withImport('test(\'example\', t => {\n\tt.plan(1, {wait: shouldWait});\n\tsetTimeout(() => t.assert.ok(value), 10);\n});'),
		withImport('test(\'example\', t => {\n\tt.plan(1, {wait: true, wait: false});\n\tsetTimeout(() => t.assert.ok(value), 10);\n});'),
		withImport('test(\'example\', t => {\n\tconst options = {wait: false};\n\tt.plan(1, {wait: true, ...options});\n\tsetTimeout(() => t.assert.ok(value), 10);\n});'),
		'import {beforeEach} from \'node:test\';\nimport assert from \'node:assert/strict\';\nbeforeEach(() => { setTimeout(() => assert.ok(value), 10); });',
		'import test from \'node:test\';\nimport assert from \'node:assert/strict\';\ntest.beforeEach(() => { setTimeout(() => assert.ok(value), 10); });',
		'import * as nodeTest from \'node:test\';\nimport assert from \'node:assert/strict\';\nnodeTest.afterEach(() => { setImmediate(() => assert.ok(value)); });',
		'import test from \'node:test\';\nimport assert from \'node:assert/strict\';\nimport {setTimeout as delay} from \'node:timers\';\ntest(\'example\', () => { delay(() => assert.ok(value), 10); });',
		'import test from \'node:test\';\nimport assert from \'node:assert/strict\';\nimport * as timers from \'node:timers\';\ntest(\'example\', () => { timers.setImmediate(() => { throw error; }); });',
		'import test from \'node:test\';\nimport assert from \'node:assert/strict\';\nimport {setTimeout as delay} from \'timers\';\ntest(\'example\', () => { delay(() => assert.ok(value), 10); });',
		inAsyncTest('load().then(value => assert.ok(value));'),
		inTest('load().catch(error => { throw error; });'),
		inTest('setTimeout(() => { try { assert.rejects(load()); } catch {} });'),
		inTest('new Promise(resolve => { setTimeout(() => { assert.ok(value); resolve(); }); });'),
		inTest('void new Promise(resolve => { setTimeout(() => { assert.ok(value); resolve(); }); });'),
		withImport('test(\'parent\', t => {\n\tload().finally(() => t.test(\'child\', () => {}));\n});'),
		inTest('setTimeout(() => { assert.ok(first); assert.ok(second); });'),
		inTest('load().then(() => { assert.ok(first); assert.ok(second); });'),
		withImport('test(\'parent\', async t => { await t.test(\'child\', childContext => { setTimeout(() => childContext.assert.ok(value)); }); });'),
		{
			code: inTest('setTimeout((() => assert.ok(value)) as () => void);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: inAsyncTest('(load().then(value => assert.ok(value)) as Promise<void>);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});
