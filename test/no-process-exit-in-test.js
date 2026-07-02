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
		withSetup('import {exit} from \'node:process\';\nexit(1);'),
		withSetup('new process.exit(1);'),
	],
	invalid: [
		// `process.exit()` anywhere in a test file
		withSetup('process.exit();'),
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

		// Import shapes that mark a file as a `node:test` file
		'import test from \'node:test\';\nprocess.exit(0);',
		'import * as nodeTest from \'node:test\';\nprocess.exit(0);',
		'import {test as nodeTest} from \'node:test\';\nprocess.exit(0);',
		'import test from \'test\';\nprocess.exit(0);',
		'import {test as bareTest} from \'test\';\nprocess.exitCode = 1;',
		'import * as bareTest from \'test\';\nprocess.exit(0);',

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
	],
});
