import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const setup = 'import {test, it, describe, suite, before, after, beforeEach, afterEach} from \'node:test\';\n';
const withSetup = code => setup + code;

test.snapshot({
	valid: [
		// Not a test file
		'process.exit();',
		'process.exitCode = 1;',

		// Not direct process exit control
		withSetup('Process.exit();'),
		withSetup('foo.exit();'),
		withSetup('exit();'),
		withSetup('const exit = process.exit;'),
		withSetup('const exitCode = process.exitCode;'),
		withSetup('assert.equal(process.exitCode, 1);'),
		withSetup('const processLike = {exitCode: 1}; processLike.exitCode = 2;'),

		// Unsupported patterns kept intentionally simple
		withSetup('process[\'exit\'](1);'),
		withSetup('process[\'exitCode\'] = 1;'),
		withSetup('const {exit} = process; exit(1);'),
		withSetup('let {exitCode} = process; exitCode = 1;'),
		withSetup('({exitCode: process.exitCode} = result);'),
		withSetup('new process.exit(1);'),

		// A bare `test` package is not Node's test runner.
		'import test from \'test\';\nprocess.exit(0);',
		'import {test as bareTest} from \'test\';\nprocess.exitCode = 1;',
		'import * as bareTest from \'test\';\nprocess.exit(0);',
		// A type-only import binds no value
		{
			code: 'import type {exit} from \'node:process\';\nimport {test} from \'node:test\';\ntest(\'a\', () => { exit(1); });',
			languageOptions: {parser: parsers.typescript},
		},
		// A parameter of the same name shadows the import
		'import {exit} from \'node:process\';\nimport {test} from \'node:test\';\ntest(\'a\', function (exit) { exit(1); });',
		// Another named export is not `process.exit`
		'import {env} from \'node:process\';\nimport {test} from \'node:test\';\ntest(\'a\', () => { env(1); });',
		'// A shadowed `globalThis` is some other object\nimport {test} from \'node:test\';\ntest(\'a\', function (globalThis) {\n	globalThis.process.exit(0);\n});',
		'// A shadowed `global` is some other object\nimport {test} from \'node:test\';\ntest(\'a\', function (global) {\n	global.process.exitCode = 1;\n});',
	],
	invalid: [
		// `process.exit()` anywhere in a test file
		withSetup('process.exit();'),
		// The named import is the same function, wherever the call is
		withSetup('import {exit} from \'node:process\';\nexit(1);'),
		withSetup('test(\'a\', () => { process.exit(0); });'),
		withSetup('it(\'a\', () => { process.exit(0); });'),
		withSetup('describe(\'suite\', () => { process.exit(0); });'),
		withSetup('suite(\'suite\', () => { process.exit(0); });'),
		withSetup('before(() => { process.exit(0); });'),
		withSetup('after(() => { process.exit(0); });'),
		withSetup('beforeEach(() => { process.exit(0); });'),
		withSetup('afterEach(() => { process.exit(0); });'),
		withSetup('test(\'a\', () => { setImmediate(() => { process.exit(0); }); });'),
		withSetup('process?.exit(0);'),
		withSetup('process.exit?.(0);'),
		withSetup('(process?.exit)(0);'),

		// `globalThis.process` / `global.process` are the same object as the bare global
		withSetup('globalThis.process.exit(0);'),
		withSetup('globalThis.process.exitCode = 1;'),
		withSetup('global.process.exit(0);'),
		withSetup('global.process.exitCode = 1;'),
		withSetup('globalThis.process.exitCode++;'),
		// A TypeScript wrapper on `globalThis` is erased at runtime
		{
			code: withSetup('(globalThis as any).process.exit(1);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withSetup('globalThis!.process.exit(1);'),
			languageOptions: {parser: parsers.typescript},
		},

		// Import shapes that mark a file as a `node:test` file
		'import test from \'node:test\';\nprocess.exit(0);',
		'import * as nodeTest from \'node:test\';\nprocess.exit(0);',
		'import {test as nodeTest} from \'node:test\';\nprocess.exit(0);',

		// `process.exitCode` writes anywhere in a test file
		withSetup('process.exitCode = 1;'),
		withSetup('test(\'a\', () => { process.exitCode = 1; });'),
		withSetup('beforeEach(() => { process.exitCode = 1; });'),
		withSetup('process.exitCode += 1;'),
		withSetup('process.exitCode &&= 1;'),
		withSetup('process.exitCode ||= 1;'),
		withSetup('process.exitCode ??= 1;'),
		withSetup('process.exitCode++;'),
		withSetup('++process.exitCode;'),
		withSetup('import process from \'node:process\';\nprocess.exit(0);'),
		withSetup('function helper(process) { process.exit(0); }'),
		withSetup('function helper(process) { process.exitCode = 1; }'),

		// TypeScript
		{
			code: withSetup('test(\'a\', () => { (process as NodeJS.Process).exit(0); });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withSetup('test(\'a\', () => { (process.exit as typeof process.exit)(0); });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withSetup('test(\'a\', () => { (process.exitCode as number) = 1; });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withSetup('test(\'a\', () => { (process as NodeJS.Process).exitCode = 1; });'),
			languageOptions: {parser: parsers.typescript},
		},

		// A named import of the export is the same function, as the two sibling rules already read it
		'import {exit} from \'node:process\';\nimport {test} from \'node:test\';\ntest(\'a\', () => { exit(1); });',
		'import {exit as bail} from \'node:process\';\nimport {test} from \'node:test\';\ntest(\'a\', () => { bail(1); });',
		'import proc from \'process\';\nimport {test} from \'node:test\';\nimport {exit} from \'node:process\';\ntest(\'a\', () => { exit(1); });',
	],
});
