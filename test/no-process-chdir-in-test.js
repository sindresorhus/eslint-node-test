import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withTestImport = code => `import test from 'node:test';\n${code}`;
const inTest = code => withTestImport(`test('changes directory', t => {\n\t${code}\n});`);

test.snapshot({
	valid: [
		// Not a test file
		'process.chdir(\'fixtures\');',

		// Reads and calls outside direct test callbacks
		inTest('const directory = process.cwd();'),
		withTestImport('process.chdir(\'fixtures\');'),
		withTestImport('test.snapshot.setResolveSnapshotPath(() => { process.chdir(\'fixtures\'); });'),
		'import {describe} from \'node:test\';\ndescribe(\'suite\', () => { process.chdir(\'fixtures\'); });',
		'import {beforeEach} from \'node:test\';\nbeforeEach(() => { process.chdir(\'fixtures\'); });',
		'import {afterEach} from \'node:test\';\nafterEach(() => { process.chdir(\'original\'); });',
		inTest('t.after(() => { process.chdir(\'original\'); });'),
		inTest('function helper() { process.chdir(\'fixtures\'); }'),
		inTest('setImmediate(() => { process.chdir(\'fixtures\'); });'),
		'import {chdir} from \'node:process\';\nimport {beforeEach} from \'node:test\';\nbeforeEach(() => { chdir(\'fixtures\'); });',

		// Unrelated or intentionally unsupported forms
		inTest('function helper(process) { process.chdir(\'fixtures\'); }'),
		inTest('const process = {chdir() {}};\nprocess.chdir(\'fixtures\');'),
		inTest('const chdir = () => {};\nchdir(\'fixtures\');'),
		inTest('process[\'chdir\'](\'fixtures\');'),
		inTest('process.chdir.call(process, \'fixtures\');'),
		inTest('const changeDirectory = process.chdir;\nchangeDirectory(\'fixtures\');'),
		inTest('const {chdir} = process;\nchdir(\'fixtures\');'),
		inTest('const {chdir} = require(\'node:process\');\nchdir(\'fixtures\');'),
		'import {chdir as changeDirectory} from \'node:process\';\nimport test from \'node:test\';\ntest(\'changes directory\', changeDirectory => { changeDirectory(\'fixtures\'); });',
		'import nodeProcess from \'node:process\';\nimport test from \'node:test\';\ntest(\'changes directory\', nodeProcess => { nodeProcess.chdir(\'fixtures\'); });',
		withTestImport('test(\'parent\', t => {\n\tfunction helper(t) {\n\t\tt.test(\'not a subtest\', () => { process.chdir(\'fixtures\'); });\n\t}\n});'),

		// Type-only test imports do not create test files
		{
			code: 'import type test from \'node:test\';\ntest(\'changes directory\', () => { process.chdir(\'fixtures\'); });',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import {type test} from \'node:test\';\ntest(\'changes directory\', () => { process.chdir(\'fixtures\'); });',
			languageOptions: {parser: parsers.typescript},
		},

		// Type-only imports do not create value bindings
		{
			code: 'import type process from \'node:process\';\nimport test from \'node:test\';\ntest(\'changes directory\', () => { process.chdir(\'fixtures\'); });',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import {type chdir} from \'node:process\';\nimport test from \'node:test\';\ntest(\'changes directory\', () => { chdir(\'fixtures\'); });',
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		// Direct calls in test callbacks
		inTest('process.chdir(\'fixtures\');'),
		'import {it} from \'node:test\';\nit(\'changes directory\', () => { process.chdir(\'fixtures\'); });',
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'changes directory\', () => { process.chdir(\'fixtures\'); });',
		withTestImport('test.only(\'changes directory\', () => { process.chdir(\'fixtures\'); });'),
		withTestImport('test.test(\'changes directory\', () => { process.chdir(\'fixtures\'); });'),

		// Process module imports
		'import process from \'node:process\';\nimport test from \'node:test\';\ntest(\'changes directory\', () => { process.chdir(\'fixtures\'); });',
		'import * as nodeProcess from \'process\';\nimport test from \'node:test\';\ntest(\'changes directory\', () => { nodeProcess.chdir(\'fixtures\'); });',
		'import {default as nodeProcess} from \'node:process\';\nimport test from \'node:test\';\ntest(\'changes directory\', () => { nodeProcess.chdir(\'fixtures\'); });',
		'import {chdir as changeDirectory} from \'node:process\';\nimport test from \'node:test\';\ntest(\'changes directory\', () => { changeDirectory(\'fixtures\'); });',
		'import {chdir as changeDirectory} from \'process\';\nimport test from \'node:test\';\ntest(\'changes directory\', () => { changeDirectory(\'fixtures\'); });',

		// Subtests
		withTestImport('test(\'parent\', async t => {\n\tawait t.test(\'changes directory\', () => {\n\t\tprocess.chdir(\'fixtures\');\n\t});\n});'),
		withTestImport('test(\'parent\', async t => {\n\tawait t.test.only(\'changes directory\', () => {\n\t\tprocess.chdir(\'fixtures\');\n\t});\n});'),

		// Optional chaining
		inTest('process?.chdir(\'fixtures\');'),
		inTest('process.chdir?.(\'fixtures\');'),

		// TypeScript
		{
			code: inTest('(process as NodeJS.Process).chdir(\'fixtures\');'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: inTest('(process.chdir as typeof process.chdir)(\'fixtures\');'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});
