import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, describe, beforeEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'startServer();',

		// Setup inside a hook — the recommended place
		withImport('beforeEach(() => { startServer(); });\ntest("x", () => {});'),

		// Call inside a test body
		withImport('test("x", () => { startServer(); });'),

		// Call inside a helper function (not a registration scope)
		withImport('function setup() { startServer(); }\ntest("x", () => { setup(); });'),

		// Registration calls themselves
		withImport('test("x", () => {});'),
		withImport('describe("s", () => { test("x", () => {}); });'),

		// A function that only registers is not setup, wherever it is written: moving it into a hook
		// would drop the registrations
		withImport('(function () {\n\ttest("x", () => {});\n})();'),
		withImport('(() => {\n\tdescribe("s", () => {\n\t\ttest("x", () => {});\n\t});\n})();'),
		withImport('(() => { beforeEach(() => {}); })();'),
		withImport('(() => test("x", () => {}))();'),
		withImport('register(() => { test("x", () => {}); });'),
		// A descriptor body that only registers is not setup either
		'import {describe} from \'node:test\';\ndescribe({name: \'a\', fn() { test("x", () => {}); }});',
		withImport('[1].forEach(() => { test("x", () => {}); });'),

		// Variable declarations are allowed (only bare calls are flagged)
		withImport('const server = startServer();\ntest("x", () => {});'),

		// Assertions are reported by no-assert-in-describe, not here
		'import {describe} from \'node:test\';\nimport assert from \'node:assert/strict\';\ndescribe("s", () => { assert.ok(a); });',
		'import {describe} from \'node:test\';\nimport assert from \'node:assert\';\ndescribe("s", () => { assert.ok(a); });',

		// The registration-call and assertion exemptions survive the value-discarding wrapper
		'import test, {before} from \'node:test\';\nawait before(() => {});\ntest("x", () => {});',
		'import test, {describe} from \'node:test\';\nvoid describe("s", () => {});\ntest("x", () => {});',
		'import test from \'node:test\';\nimport assert from \'node:assert\';\nawait assert.ok(a);\ntest("x", () => {});',

		// `delete` removes a property instead of invoking one
		withImport('delete cache.entry;\ntest("x", () => {});'),
		// Nested one level deeper, so not directly in a registration scope
		withImport('describe("s", () => { if (ready) { seedData(); } test("x", () => {}); });'),
		withImport('describe("s", () => { try { seedData(); } catch {} test("x", () => {}); });'),
		// On the right of an assignment the call is not a bare statement
		withImport('server = startServer();\ntest("x", () => {});'),
		// `typeof` on a bare identifier reads a binding, it does not call anything
		withImport('typeof startServer;\ntest("x", () => {});'),

		// A call assigned to a variable is a declaration, handled by the valid case above
		withImport('const server = await startServer();\ntest("x", () => {});'),

		// Allowed via the `allow` option
		{
			code: withImport('log("loaded");\ntest("x", () => {});'),
			options: [{allow: ['log']}],
		},
		{
			code: withImport('console.log("loaded");\ntest("x", () => {});'),
			options: [{allow: ['console.log']}],
		},
		{
			code: withImport('describe("s", () => { seedData(); test("x", () => {}); });'),
			options: [{allow: ['seedData']}],
		},
		// A loop or an expression body is not a bare statement in the suite body
		'import {describe} from \'node:test\';\ndescribe(\'s\', () => { for (const x of xs) { setup(); } });',
		'import {describe} from \'node:test\';\ndescribe(\'s\', () => setup());',
		// A test or hook body named out of line runs as that test's own body
		'import {describe, test} from \'node:test\';\nfunction body() { setup(); }\ntest(\'a\', body);',
		'import {describe, test} from \'node:test\';\nconst body = () => { setup(); };\ntest(\'a\', body);',
		'import {describe, beforeEach} from \'node:test\';\nfunction body() { setup(); }\nbeforeEach(body);',
	],
	invalid: [
		// An immediately invoked function that does real setup still runs at load time
		withImport('(function () {\n\tstartServer();\n})();'),
		withImport('(() => {\n\tstartServer();\n\ttest("x", () => {});\n})();'),
		withImport('[1].forEach(() => { startServer(); });'),

		// Bare setup call at the module top level
		withImport('startServer();\ntest("x", () => {});'),
		// A call with no function among its arguments has nothing to inspect
		withImport('register(test("x", () => {}));'),
		// A namespace import still makes a registration scope
		'import * as nodeTest from \'node:test\';\nseedData();\nnodeTest.test("x", () => {});',
		// The `suite` alias has the same registration scope as `describe`
		withImport('suite("s", () => { seedData(); test("x", () => {}); });'),

		// Setup call directly in a describe body
		withImport('describe("s", () => { seedData(); test("x", () => {}); });'),

		// Member-expression setup call
		withImport('database.connect();\ntest("x", () => {});'),

		// Nested describe body
		withImport('describe("s", () => { describe("inner", () => { seedData(); test("x", () => {}); }); });'),

		// Not in the allow list
		{
			code: withImport('log("loaded");\ntest("x", () => {});'),
			options: [{allow: ['debug']}],
		},

		// TypeScript
		{
			code: withImport('startServer();\ntest("x", () => {});'),
			languageOptions: {parser: parsers.typescript},
		},

		// A discarded or awaited return value does not move the call out of the load phase
		withImport('await startServer();\ntest("x", () => {});'),
		withImport('await database.connect();\ntest("x", () => {});'),
		withImport('void startServer();\ntest("x", () => {});'),
		withImport('!startServer();\ntest("x", () => {});'),
		withImport('void database.connect();\ntest("x", () => {});'),
		withImport('+startServer();\ntest("x", () => {});'),

		// Inside a suite body too
		withImport('describe("s", async () => { await seedData(); test("x", () => {}); });'),
		withImport('describe("s", () => { void seedData(); test("x", () => {}); });'),

		// The `allow` list still applies through the wrapper
		{
			code: withImport('await log("loaded");\ntest("x", () => {});'),
			options: [{allow: ['debug']}],
		},
		// The allow list matches the callee text exactly
		{
			code: withImport('console.log("loaded");\ntest("x", () => {});'),
			options: [{allow: ['log']}],
		},

		// Optional chaining is an expression wrapper too. Walking up from it instead of unwrapping
		// down used to loop forever, so these are here to keep the walk finite.
		withImport('await server?.start();\ntest("x", () => {});'),
		withImport('void server?.start();\ntest("x", () => {});'),
		withImport('!server?.start();\ntest("x", () => {});'),
		withImport('typeof server?.start?.();\ntest("x", () => {});'),

		// A TypeScript wrapper under `await` unwraps the same way
		{
			code: withImport('await (startServer() as Promise<void>);\ntest("x", () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('void (startServer() as unknown);\ntest("x", () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		// The descriptor / options.fn suite forms still run the body at load time
		'import {describe} from \'node:test\';\ndescribe({name: \'a\', fn() { setup(); }});',
		'import {describe} from \'node:test\';\ndescribe(\'a\', {fn() { setup(); }});',
		'import {suite} from \'node:test\';\nsuite(\'a\', {fn() { setup(); }});',
		// A bare call at the top level is what the default `allow` is about
		'import {test} from \'node:test\';\nconsole.log(\'top level\');\ntest(\'a\', () => {});',
		// A suite body named out of line runs at collection time, exactly as the inline one does
		'import {describe} from \'node:test\';\nconst body = () => { setup(); };\ndescribe(\'s\', body);',
		'import {describe} from \'node:test\';\ndescribe(\'s\', body);\nfunction body() { setup(); }',
		'import {describe} from \'node:test\';\nconst body = () => { setup(); };\ndescribe(\'s\', {fn: body});',
		'import {describe} from \'node:test\';\nconst body = () => { setup(); };\ndescribe(\'s\', body, {skip: true});',
	],
});
