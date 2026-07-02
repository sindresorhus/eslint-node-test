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
		// All `mock.timers.*` usage is flagged, not just `enable`
		withImport('mock.timers.tick(100);'),
		withImport('mock.timers.reset();'),

		// Inside a test but still using the global
		withImport('test("a", t => { mock.method(obj, "fn"); });'),

		// Renamed import
		'import {mock as m} from \'node:test\';\nm.fn();',

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.mock.fn();',

		// TypeScript
		{
			code: withImport('mock.method(obj as Target, "fn");'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});
