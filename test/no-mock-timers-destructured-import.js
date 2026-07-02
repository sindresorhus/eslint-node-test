import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const head = 'import {test, mock} from \'node:test\';\n';

test.snapshot({
	valid: [
		// Not a test file
		'import {setTimeout} from \'node:timers\';\nmock.timers.enable();',

		// Timer import but no mock.timers.enable
		head + 'import {setTimeout} from \'node:timers\';\nsetTimeout(fn, 1000);',

		// Mock.timers.enable but no destructured timer import
		head + 'mock.timers.enable({apis: ["setTimeout"]});',

		// Enabled api does not match the imported function
		head + 'import {setInterval} from \'node:timers\';\nmock.timers.enable({apis: ["setTimeout"]});',

		// Namespace timer import is not destructured — the mock intercepts it
		head + 'import * as timers from \'node:timers\';\nmock.timers.enable();\ntimers.setTimeout(fn, 1);',
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
	],
});
