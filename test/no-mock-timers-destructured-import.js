import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const head = 'import {test, mock} from \'node:test\';\n';

test.snapshot({
	valid: [
		// A `Date`-only list mocks no timer function, so the namespace import is harmless, exactly as it is for a named import
		head + 'import * as timers from \'node:timers\';\nmock.timers.enable({apis: ["Date"]});',
		head + 'import {setTimeout} from \'node:timers\';\nmock.timers.enable({apis: ["Date"]});',
		head + 'import {setTimeout} from \'node:timers\';\nimport * as timers from \'node:timers\';\nmock.timers.enable({apis: ["Date"]});',
		// The enabled APIs accumulate over the file, and none of the calls here is a timer API
		head + 'import {setTimeout} from \'node:timers\';\nmock.timers.enable({apis: []});\nmock.timers.enable({apis: ["Date"]});',

		// A default import is the module object itself, so `timers.setTimeout` reads the installed mock at call time
		head + 'import timers from \'node:timers\';\nmock.timers.enable();',
		// A computed `enable` is not recognized as an enable call
		head + 'import {setTimeout} from \'node:timers\';\nmock.timers["enable"]();',
		// An `apis` value that cannot be resolved at lint time proves nothing, so the imported timer may well not be among the enabled APIs
		`${head}import {setTimeout} from 'node:timers';\nconst APIS = ['setInterval'];\ntest('a', () => { mock.timers.enable({apis: APIS}); });`,
		`${head}import {setTimeout} from 'node:timers';\ntest('a', () => { mock.timers.enable({apis: config.apis}); });`,
		`${head}import {setTimeout} from 'node:timers';\ntest('a', () => { mock.timers.enable({apis: ['setTimeout', ...rest]}); });`,
		`${head}import {setTimeout} from 'node:timers';\ntest('a', () => { mock.timers.enable({apis: []}); });`,
		`${head}import {setTimeout} from 'node:timers';\nconst extra = {apis: ['setTimeout']};\ntest('a', () => { mock.timers.enable({apis: ['setInterval'], ...extra}); });`,
		`${head}import {setTimeout} from 'node:timers';\ntest('a', () => { mock.timers.enable({...config, apis: ['setInterval']}); });`,
		// An options argument that is not an object literal is not statically known either
		`${head}import {setTimeout} from 'node:timers';\nconst options = {apis: ['Date']};\nmock.timers.enable(options);`,
		`${head}import {setTimeout} from 'node:timers';\nmock.timers.enable(getOptions());`,
		`${head}import {setTimeout} from 'node:timers';\nmock.timers.enable(...args);`,
		// A cast on the options is unwrapped, so its `apis` list is read
		{
			code: `${head}import {setTimeout} from 'node:timers';\nmock.timers.enable({apis: ['Date']} as const);`,
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: `${head}import {setTimeout} from 'node:timers';\nmock.timers.enable({apis: ['Date']} satisfies object);`,
			languageOptions: {parser: parsers.typescript},
		},
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
		// A type-only namespace import is erased as well, so the code calls the interceptable globals
		{
			code: head + 'import type * as timers from \'node:timers\';\nmock.timers.enable();',
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

		// A string-literal name is the same export, and `mock.timers` cannot intercept it either
		head + 'import {\'setTimeout\' as st} from \'node:timers\';\nmock.timers.enable();',
		head + 'import {\'setImmediate\' as si} from \'node:timers\';\nmock.timers.enable({apis: [\'setImmediate\']});',

		// Specific api enabled
		head + 'import {setTimeout} from \'node:timers\';\nmock.timers.enable({apis: ["setTimeout"]});',

		// ClearTimeout is mocked together with setTimeout
		head + 'import {setTimeout, clearTimeout} from \'node:timers\';\nmock.timers.enable({apis: ["setTimeout"]});',
		// And so is clearImmediate with setImmediate
		head + 'import {clearImmediate} from \'node:timers\';\nmock.timers.enable({apis: ["setImmediate"]});',

		// Only the specifiers whose API is enabled are reported, and the enabled APIs accumulate over every `enable` call in the file
		head + 'import {setTimeout, setInterval} from \'node:timers\';\nmock.timers.enable({apis: ["setTimeout"]});',
		head + 'import {setTimeout} from \'node:timers\';\nmock.timers.enable({apis: []});\nmock.timers.enable({apis: ["setTimeout"]});',

		// `getTestContext()` and a hook parameter name a context tracker too
		'import {test, getTestContext} from \'node:test\';\nimport {setTimeout} from \'node:timers\';\ntest(\'a\', () => { getTestContext().mock.timers.enable({apis: ["setTimeout"]}); });',
		head + 'import {setTimeout} from \'node:timers\';\ntest("a", t => { t.beforeEach(hookContext => { hookContext.mock.timers.enable({apis: ["setTimeout"]}); }); });',

		// Renamed import
		head + 'import {setTimeout as delay} from \'node:timers\';\nmock.timers.enable();',

		// `timers` bare specifier
		head + 'import {setInterval} from \'timers\';\nmock.timers.enable({apis: ["setInterval"]});',

		// Enable() inside a test, via context mock
		head + 'import {setTimeout} from \'node:timers\';\ntest("a", t => { t.mock.timers.enable({apis: ["setTimeout"]}); });',

		// A parenthesized optional chain on the context mock.
		head + 'import {setTimeout} from \'node:timers\';\ntest("a", t => { (t?.mock).timers.enable({apis: ["setTimeout"]}); });',

		// A TypeScript wrapper on a `getTestContext()` receiver is erased at runtime.
		{
			code: 'import {getTestContext} from \'node:test\';\nimport {setTimeout} from \'node:timers\';\n(getTestContext() as any).mock.timers.enable({apis: ["setTimeout"]});',
			languageOptions: {parser: parsers.typescript},
		},

		// A TypeScript wrapper on the receiver is erased at runtime
		{
			code: head + 'import {setTimeout} from \'node:timers\';\ntest("a", (t: any) => { (t as any).mock.timers.enable({apis: ["setTimeout"]}); });',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: head + 'import {setTimeout} from \'node:timers\';\ntest("a", t => { t!.mock.timers.enable({apis: ["setTimeout"]}); });',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: head + 'import {setTimeout} from \'node:timers\';\ntest("a", t => { (t.mock satisfies any).timers.enable({apis: ["setTimeout"]}); });',
			languageOptions: {parser: parsers.typescript},
		},

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
		// A namespace import holds the real timer functions (a snapshot taken at import time), so `mock.timers` cannot intercept `timers.setTimeout(…)` either.
		head + 'import * as timers from \'node:timers\';\nmock.timers.enable();\ntimers.setTimeout(fn, 1);',
		head + 'import * as timers from \'node:timers\';\nmock.timers.enable({apis: ["setTimeout"]});\ntimers.setTimeout(fn, 1);',
		head + 'import * as timers from \'node:timers\';\nmock.timers.enable({apis: ["Date", "setImmediate"]});\ntimers.setImmediate(fn);',

		// A TypeScript wrapper on the `enable` callee must not hide it
		{
			code: head + 'import {setTimeout} from \'node:timers\';\ntest(\'a\', (t: any) => { t.mock.timers.enable!({apis: [\'setTimeout\']}); setTimeout(f, 1); });',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: head + 'import {setTimeout} from \'node:timers\';\ntest(\'a\', (t: any) => { (t.mock.timers.enable as any)({apis: [\'setTimeout\']}); setTimeout(f, 1); });',
			languageOptions: {parser: parsers.typescript},
		},

		// `undefined`, `void 0` and `null` are three ways to write "no apis given", and the runner takes that as every timer API
		`${head}import {setTimeout} from 'node:timers';\ntest('a', () => { mock.timers.enable({apis: undefined}); setTimeout(f, 1); });`,
		`${head}import {setTimeout} from 'node:timers';\ntest('a', () => { mock.timers.enable({apis: null}); setTimeout(f, 1); });`,
		`${head}import {setTimeout} from 'node:timers';\ntest('a', () => { mock.timers.enable({apis: void 0}); setTimeout(f, 1); });`,
		// The same goes for the whole options argument
		`${head}import {setTimeout} from 'node:timers';\nmock.timers.enable(undefined);`,
		`${head}import {setTimeout} from 'node:timers';\nmock.timers.enable(null);`,
		`${head}import {setTimeout} from 'node:timers';\nmock.timers.enable(void 0);`,
		// A computed key that folds to a constant hides no `apis`, so every timer API is mocked
		`${head}import {setTimeout} from 'node:timers';\nmock.timers.enable({['now']: 1000});`,

		// A TypeScript wrapper on the receiver must not hide the call
		{
			code: `${head}import {setTimeout} from 'node:timers';\ntest('a', () => { (mock.timers as any).enable({apis: ['setTimeout']}); setTimeout(f, 1); });`,
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: `${head}import {setTimeout} from 'node:timers';\ntest('a', t => { (t.mock.timers as any).enable({apis: ['setTimeout']}); setTimeout(f, 1); });`,
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: `${head}import {setTimeout} from 'node:timers';\ntest('a', () => { (mock!.timers).enable({apis: ['setTimeout']}); setTimeout(f, 1); });`,
			languageOptions: {parser: parsers.typescript},
		},

		// A TypeScript wrapper on the `apis` list or on one of its entries is erased at runtime, so the list is still known: only `setTimeout` is reported, not `clearInterval`
		{
			code: `${head}import {setTimeout, clearInterval} from 'node:timers';\nmock.timers.enable({apis: ['setTimeout'] as const});`,
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: `${head}import {setTimeout, clearInterval} from 'node:timers';\nmock.timers.enable({apis: ['setTimeout'] satisfies string[]});`,
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: `${head}import {setTimeout, clearInterval} from 'node:timers';\nmock.timers.enable({apis: ['setTimeout' as const]});`,
			languageOptions: {parser: parsers.typescript},
		},
	],
});
