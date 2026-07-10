import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withTest = code => `import test, {assert, snapshot} from 'node:test';\ntest('t', () => {\n\t${code}\n});`;

test.snapshot({
	valid: [
		// Configuration must run before tests, not during one.
		'import {assert, snapshot} from \'node:test\';\nsnapshot.setDefaultSnapshotSerializers([]);\nsnapshot.setResolveSnapshotPath(path => path);\nassert.register(\'custom\', () => {});',

		// Suites and top-level hooks run as setup, not as a test.
		'import {describe, snapshot} from \'node:test\';\ndescribe(\'suite\', () => { snapshot.setDefaultSnapshotSerializers([]); });',
		'import {beforeEach, snapshot} from \'node:test\';\nbeforeEach(() => { snapshot.setResolveSnapshotPath(path => path); });',
		'import test, {snapshot} from \'node:test\';\ntest.beforeEach(() => { snapshot.setResolveSnapshotPath(path => path); });',
		'import {beforeEach, describe, snapshot} from \'node:test\';\ndescribe(\'suite\', {timeout: beforeEach(() => { snapshot.setResolveSnapshotPath(path => path); })}, () => {});',

		// Configuration expressions in test registration arguments are not inside the callback.
		'import test, {snapshot} from \'node:test\';\ntest(\'t\', {skip: snapshot.setResolveSnapshotPath(path => path)}, () => {});',
		'import test, {snapshot} from \'node:test\';\ntest(\'outer\', () => { test(\'inner\', {skip: snapshot.setResolveSnapshotPath(path => path)}, () => {}); });',
		'import test, {snapshot} from \'node:test\';\ntest(\'outer\', t => { t.test(\'inner\', {skip: snapshot.setResolveSnapshotPath(path => path)}, () => {}); });',
		'import test, {snapshot} from \'node:test\';\ntest(\'outer\', () => { test.todo(\'inner\', {skip: snapshot.setResolveSnapshotPath(path => path)}); });',
		'import test, {snapshot} from \'node:test\';\ntest(\'outer\', t => { t.test.todo(\'inner\', {skip: snapshot.setResolveSnapshotPath(path => path)}); });',

		// Unrelated APIs and test-context assertions are not global `node:test` configuration.
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'t\', t => { assert.register(\'custom\', () => {}); t.assert.register(\'custom\', () => {}); });',
		withTest('custom.snapshot.setDefaultSnapshotSerializers([]);'),
		withTest('custom.assert.register(\'custom\', () => {});'),

		// Computed properties and destructured aliases are intentionally ignored.
		withTest('snapshot[\'setDefaultSnapshotSerializers\']([]);'),
		withTest('assert[\'register\'](\'custom\', () => {});'),
		withTest('const {setResolveSnapshotPath} = snapshot; setResolveSnapshotPath(path => path);'),
		withTest('const {register} = assert; register(\'custom\', () => {});'),

		// Nested functions in a suite remain outside every test callback.
		'import {describe, snapshot} from \'node:test\';\ndescribe(\'suite\', () => { function configure() { snapshot.setDefaultSnapshotSerializers([]); } configure(); });',
		'import {beforeEach, describe, snapshot} from \'node:test\';\ndescribe.foo(\'suite\', () => { beforeEach(() => { snapshot.setResolveSnapshotPath(path => path); }); });',

		// Shadowed bindings are unrelated objects.
		'import test, {snapshot} from \'node:test\';\ntest(\'t\', () => { { const snapshot = custom; snapshot.setDefaultSnapshotSerializers([]); } });',
	],
	invalid: [
		// Named imports.
		withTest('snapshot.setDefaultSnapshotSerializers([]);'),
		withTest('snapshot.setResolveSnapshotPath(path => path);'),
		withTest('assert.register(\'custom\', () => {});'),

		// Renamed imports.
		'import test, {snapshot as testSnapshot} from \'node:test\';\ntest(\'t\', () => { testSnapshot.setDefaultSnapshotSerializers([]); });',
		'import test, {assert as testAssert} from \'node:test\';\ntest(\'t\', () => { testAssert.register(\'custom\', () => {}); });',

		// Default, named, and namespace imports expose the same configuration objects.
		'import test from \'node:test\';\ntest(\'t\', () => { test.snapshot.setResolveSnapshotPath(path => path); test.assert.register(\'custom\', () => {}); });',
		'import {test} from \'node:test\';\ntest(\'t\', () => { test.snapshot.setDefaultSnapshotSerializers([]); });',
		'import {it} from \'node:test\';\nit(\'t\', () => { it.assert.register(\'custom\', () => {}); });',
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'t\', () => { nodeTest.snapshot.setDefaultSnapshotSerializers([]); nodeTest.assert.register(\'custom\', () => {}); });',

		// Test modifiers and subtests.
		'import test, {snapshot} from \'node:test\';\ntest.only(\'t\', () => { snapshot.setResolveSnapshotPath(path => path); });',
		'import test, {assert} from \'node:test\';\ntest(\'parent\', t => { t.test(\'child\', () => { assert.register(\'custom\', () => {}); }); });',
		'import test, {snapshot} from \'node:test\';\ntest(\'parent\', t => { t.test.only(\'child\', () => { snapshot.setDefaultSnapshotSerializers([]); }); });',

		// Renamed test imports.
		'import {test as run, snapshot} from \'node:test\';\nrun(\'t\', () => { snapshot.setDefaultSnapshotSerializers([]); });',
		'import {assert, it as specify} from \'node:test\';\nspecify(\'t\', () => { assert.register(\'custom\', () => {}); });',

		// Suite-local hooks run while tests execute.
		'import {beforeEach, describe, snapshot} from \'node:test\';\ndescribe(\'suite\', () => { beforeEach(() => { snapshot.setResolveSnapshotPath(path => path); }); });',
		'import test, {describe, snapshot} from \'node:test\';\ndescribe(\'suite\', () => { test.beforeEach(() => { snapshot.setResolveSnapshotPath(path => path); }); });',
		'import * as nodeTest from \'node:test\';\nnodeTest.describe(\'suite\', () => { nodeTest.test.beforeEach(() => { nodeTest.snapshot.setResolveSnapshotPath(path => path); }); });',

		// Nested functions and callbacks are still lexically inside the test.
		withTest('function configure() { snapshot.setDefaultSnapshotSerializers([]); } configure();'),
		withTest('setImmediate(() => { assert.register(\'custom\', () => {}); });'),

		// Optional chaining.
		withTest('snapshot?.setDefaultSnapshotSerializers([]);'),
		withTest('assert.register?.(\'custom\', () => {});'),

		// TypeScript wrappers.
		{
			code: withTest('(snapshot as typeof snapshot).setResolveSnapshotPath(path => path);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from \'node:test\';\n(test as typeof test)(\'t\', () => { (test.assert as typeof test.assert).register(\'custom\', () => {}); });',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test, {snapshot} from \'node:test\';\n(test<string>)(\'t\', () => { (snapshot.setDefaultSnapshotSerializers<unknown>)([]); });',
			languageOptions: {parser: parsers.typescript},
		},
	],
});
