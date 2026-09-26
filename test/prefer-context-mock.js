import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, mock} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'mock.fn();',

		// Context mock — the recommended form
		withImport('test("a", t => { t.mock.method(obj, "fn"); });'),
		withImport('test("a", t => { t.mock.fn(); });'),

		// Global mock cleanup methods are not flagged
		withImport('mock.reset();'),
		withImport('mock.restoreAll();'),

		// `mock` not imported from node:test
		'import test from \'node:test\';\nimport {mock} from \'./local.js\';\nmock.fn();',
		'import test from \'node:test\';\nmock.fn();',

		// A computed member is not read as an accessor
		withImport('mock[\'fn\']();'),

		// Shadowed import name
		withImport('function helper(mock) {\n\tmock.fn();\n}\nhelper(localMock);'),
		// `mock.timers` is only state-creating through `enable`; `tick`/`runAll` create no
		// state and `reset` restores. `t.mock` is a different tracker, so these are left alone.
		withImport('mock.timers.tick(100);'),
		withImport('mock.timers.runAll();'),
		withImport('mock.timers.reset();'),
	],
	invalid: [
		// Global mock creation methods
		withImport('mock.fn();'),
		withImport('mock.method(obj, "fn");'),
		withImport('mock.getter(obj, "x");'),
		withImport('mock.setter(obj, "x");'),
		withImport('mock.property(obj, "x", 1);'),
		withImport('mock.module("node:fs", {});'),

		// Global mock timers
		withImport('mock.timers.enable({apis: ["setTimeout"]});'),

		// The accessor further down the chain is still the state-creating one
		withImport('mock.fn.call(obj, 1);'),
		// Only the `enable` call is state-creating, so the chained `tick` is left alone
		withImport('mock.timers.enable({apis: ["setTimeout"]}).tick(1);'),
		withImport('(mock.timers.enable)();'),

		// Inside a test but still using the global
		withImport('test("a", t => { mock.method(obj, "fn"); });'),

		// Renamed import
		'import {mock as m} from \'node:test\';\nm.fn();',

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.mock.fn();',

		// Named test import
		'import {test} from \'node:test\';\ntest.mock.fn();',

		// TypeScript
		{
			code: withImport('mock.method(obj as Target, "fn");'),
			languageOptions: {parser: parsers.typescript},
		},
		// TypeScript: a mid-chain cast must not break the walk down to the global `mock`
		{
			code: withImport('(mock.timers as any).enable();'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});
