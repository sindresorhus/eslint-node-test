import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const head = 'import {test, mock} from \'node:test\';\n';

test.snapshot({
	valid: [
		// An `apis` value that cannot be resolved at lint time proves nothing, so the imported
		// timer may well not be among the enabled APIs
		`${head}import {setTimeout} from 'node:timers';\nconst APIS = ['setInterval'];\ntest('a', () => { mock.timers.enable({apis: APIS}); });`,
		`${head}import {setTimeout} from 'node:timers';\ntest('a', () => { mock.timers.enable({apis: config.apis}); });`,
		`${head}import {setTimeout} from 'node:timers';\ntest('a', () => { mock.timers.enable({apis: ['setTimeout', ...rest]}); });`,
		`${head}import {setTimeout} from 'node:timers';\ntest('a', () => { mock.timers.enable({apis: []}); });`,
		`${head}import {setTimeout} from 'node:timers';\nconst extra = {apis: ['setTimeout']};\ntest('a', () => { mock.timers.enable({apis: ['setInterval'], ...extra}); });`,
		`${head}import {setTimeout} from 'node:timers';\ntest('a', () => { mock.timers.enable({...config, apis: ['setInterval']}); });`,
		// Not a test file
		'import {setTimeout} from \'node:timers\';\nmock.timers.enable();',

		// Timer import but no mock.timers.enable
		head + 'import {setTimeout} from \'node:timers\';\nsetTimeout(fn, 1000);',

		// Mock.timers.enable but no destructured timer import
		head + 'mock.timers.enable({apis: ["setTimeout"]});',

		// Enabled api does not match the imported function
		head + 'import {setInterval} from \'node:timers\';\nmock.timers.enable({apis: ["setTimeout"]});',

		// Type-only timer imports are erased — the code still calls the interceptable global
		{
			code: head + 'import {type setTimeout} from \'node:timers\';\nmock.timers.enable({apis: ["setTimeout"]});',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: head + 'import type {setTimeout} from \'node:timers\';\nmock.timers.enable({apis: ["setTimeout"]});',
			languageOptions: {parser: parsers.typescript},
		},

		// `foo.mock` is not a test context, so its `timers` have nothing to do with the global tracker
		`${head}import {setTimeout} from 'node:timers';\nfoo.mock.timers.enable({apis: ['setTimeout']});`,
		// A shadowed `mock` parameter is a different object entirely
		`${head}import {setTimeout} from 'node:timers';\nfunction helper(mock) {\n\tmock.timers.enable({apis: ['setTimeout']});\n}`,
	],
	invalid: [
		// Destructured setTimeout + enable all
		head + 'import {setTimeout} from \'node:timers\';\nmock.timers.enable();',

		// Specific api enabled
		head + 'import {setTimeout} from \'node:timers\';\nmock.timers.enable({apis: ["setTimeout"]});',

		// ClearTimeout is mocked together with setTimeout
		head + 'import {setTimeout, clearTimeout} from \'node:timers\';\nmock.timers.enable({apis: ["setTimeout"]});',

		// Renamed import
		head + 'import {setTimeout as delay} from \'node:timers\';\nmock.timers.enable();',

		// `timers` bare specifier
		head + 'import {setInterval} from \'timers\';\nmock.timers.enable({apis: ["setInterval"]});',

		// Enable() inside a test, via context mock
		head + 'import {setTimeout} from \'node:timers\';\ntest("a", t => { t.mock.timers.enable({apis: ["setTimeout"]}); });',

		// Namespace import — `nodeTest.mock.timers.enable()`
		'import * as nodeTest from \'node:test\';\nimport {setTimeout} from \'node:timers\';\nnodeTest.mock.timers.enable();',

		// TypeScript
		{
			code: head + 'import {setImmediate} from \'node:timers\';\nmock.timers.enable({apis: ["setImmediate"]});',
			languageOptions: {parser: parsers.typescript},
		},

		// A mixed specifier list still reports the runtime (value) import alongside a type-only one
		{
			code: head + 'import {type clearTimeout, setTimeout} from \'node:timers\';\nmock.timers.enable({apis: ["setTimeout"]});',
			languageOptions: {parser: parsers.typescript},
		},
		// A namespace import holds the real timer functions (a snapshot taken at import time), so
		// `mock.timers` cannot intercept `timers.setTimeout(…)` either.
		head + 'import * as timers from \'node:timers\';\nmock.timers.enable();\ntimers.setTimeout(fn, 1);',

		// A TypeScript wrapper on the `enable` callee must not hide it
		{
			code: head + 'import {setTimeout} from \'node:timers\';\ntest(\'a\', (t: any) => { t.mock.timers.enable!({apis: [\'setTimeout\']}); setTimeout(f, 1); });',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: head + 'import {setTimeout} from \'node:timers\';\ntest(\'a\', (t: any) => { (t.mock.timers.enable as any)({apis: [\'setTimeout\']}); setTimeout(f, 1); });',
			languageOptions: {parser: parsers.typescript},
		},
	],
});
