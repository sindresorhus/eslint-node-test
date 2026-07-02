import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withTestImport = code => `import test from 'node:test';\n${code}`;
const withBeforeEachImport = code => `import {beforeEach} from 'node:test';\n${code}`;
const withAfterEachImport = code => `import {afterEach} from 'node:test';\n${code}`;
const inTest = code => withTestImport(`test('reads config', t => {\n\t${code}\n});`);

test.snapshot({
	valid: [
		// Not a test file
		'process.env.NODE_ENV = \'production\';',

		// Reading is fine
		inTest('const nodeEnvironment = process.env.NODE_ENV;'),
		inTest('assert.equal(process.env.NODE_ENV, \'test\');'),

		// Outside test callbacks
		withTestImport('process.env.NODE_ENV = \'production\';'),
		withTestImport('delete process.env.NODE_ENV;'),
		'import test from \'node:test\';\ntest.snapshot.setResolveSnapshotPath(() => {\n\tprocess.env.NODE_ENV = \'production\';\n});',

		// Hooks own setup and teardown
		withBeforeEachImport('beforeEach(() => { process.env.NODE_ENV = \'production\'; });'),
		withAfterEachImport('afterEach(() => { delete process.env.NODE_ENV; });'),
		inTest('t.after(() => { delete process.env.NODE_ENV; });'),
		inTest('setImmediate(() => { process.env.NODE_ENV = \'production\'; });'),

		// Other process properties are out of scope
		inTest('process.stdout.write(\'debug\');'),
		inTest('process.chdir(\'fixtures\');'),

		// Mutating calls that target `process` itself are out of scope
		inTest('Object.defineProperty(process, \'env\', {value: {}});'),
		inTest('Reflect.set(process, \'env\', {});'),

		// Shadowed globals
		inTest('function helper(process) {\n\tprocess.env.NODE_ENV = \'production\';\n}'),
		inTest('const Object = {assign() {}};\nObject.assign(process.env, values);'),
		inTest('const Reflect = {set() {}};\nReflect.set(process.env, \'NODE_ENV\', \'production\');'),
		inTest('const env = \'stdout\';\nprocess[env].NODE_ENV = \'production\';'),
		inTest('const assign = \'keys\';\nObject[assign](process.env, values);'),
		inTest('const set = \'get\';\nReflect[set](process.env, \'NODE_ENV\', \'production\');'),

		// Reassigning an alias does not mutate `process.env`
		inTest('let environment = process.env;\nenvironment = {};\nenvironment.NODE_ENV = \'production\';'),
		inTest('const environment = process.env;\nenvironment = {};'),
		inTest('const {env: environment} = process;\n[environment] = [{}];'),
		'import process from \'node:process\';\nimport test from \'node:test\';\ntest(\'reads config\', () => {\n\tfunction helper(process) {\n\t\tprocess.env.NODE_ENV = \'production\';\n\t}\n});',
		'import {env} from \'node:process\';\nimport test from \'node:test\';\ntest(\'reads config\', () => {\n\tfunction helper(env) {\n\t\tenv.NODE_ENV = \'production\';\n\t}\n});',
		'import test from \'node:test\';\n{\n\tconst test = (name, callback) => callback();\n\ttest(\'reads config\', () => {\n\t\tprocess.env.NODE_ENV = \'production\';\n\t});\n}',
		'import test from \'node:test\';\ntest(\'parent\', t => {\n\tfunction helper(t) {\n\t\tt.test(\'not a subtest\', () => {\n\t\t\tprocess.env.NODE_ENV = \'production\';\n\t\t});\n\t}\n});',

		// Unsupported CommonJS import shape
		withTestImport('const {env} = require(\'node:process\');\ntest(\'reads config\', () => {\n\tenv.NODE_ENV = \'production\';\n});'),
	],
	invalid: [
		// Direct member mutations
		inTest('process.env.NODE_ENV = \'production\';'),
		inTest('process.env[\'NODE_ENV\'] = \'production\';'),
		inTest('process.env.NODE_ENV = value;'),
		inTest('{\n\tconst t = {mock: {property() {}}};\n\tprocess.env.NODE_ENV = \'production\';\n}'),
		inTest('const result = (process.env.NODE_ENV = \'production\');'),
		inTest('process.env.NODE_ENV += \'-test\';'),
		inTest('process.env.COUNT++;'),
		inTest('++process.env.COUNT;'),
		inTest('delete process.env.NODE_ENV;'),
		inTest('process.env[name] = \'production\';'),
		inTest('process[\'env\'].NODE_ENV = \'production\';'),
		inTest('[process.env.NODE_ENV] = [\'production\'];'),
		inTest('({nodeEnvironment: process.env.NODE_ENV} = values);'),
		inTest('for (process.env.NODE_ENV of values) {}'),
		'import test from \'node:test\';\ntest(\'reads config\', async t => {\n\tfor await (process.env.NODE_ENV of values) {}\n});',
		inTest('for (process.env.NODE_ENV in values) {}'),
		inTest('for ({nodeEnvironment: process.env.NODE_ENV} of values) {}'),
		'import test from \'node:test\';\ntest.only(\'reads config\', () => {\n\tprocess.env.NODE_ENV = \'production\';\n});',
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'reads config\', () => {\n\tprocess.env.NODE_ENV = \'production\';\n});',
		'import {test as nodeTest} from \'node:test\';\nnodeTest(\'reads config\', () => {\n\tprocess.env.NODE_ENV = \'production\';\n});',
		'import {it} from \'node:test\';\nit(\'reads config\', () => {\n\tprocess.env.NODE_ENV = \'production\';\n});',

		// Mutating `process.env` itself
		inTest('process.env = {};'),
		inTest('delete process.env;'),

		// Imported process forms
		'import process from \'node:process\';\nimport test from \'node:test\';\ntest(\'reads config\', () => {\n\tprocess.env.NODE_ENV = \'production\';\n});',
		'import process from \'process\';\nimport test from \'node:test\';\ntest(\'reads config\', () => {\n\tprocess.env.NODE_ENV = \'production\';\n});',
		'import * as nodeProcess from \'node:process\';\nimport test from \'node:test\';\ntest(\'reads config\', () => {\n\tnodeProcess.env.NODE_ENV = \'production\';\n});',
		'import * as nodeProcess from \'process\';\nimport test from \'node:test\';\ntest(\'reads config\', () => {\n\tnodeProcess.env.NODE_ENV = \'production\';\n});',
		'import {default as nodeProcess} from \'node:process\';\nimport test from \'node:test\';\ntest(\'reads config\', () => {\n\tnodeProcess.env.NODE_ENV = \'production\';\n});',
		'import {env} from \'node:process\';\nimport test from \'node:test\';\ntest(\'reads config\', () => {\n\tenv.NODE_ENV = \'production\';\n});',
		'import {env as environment} from \'node:process\';\nimport test from \'node:test\';\ntest(\'reads config\', () => {\n\tenvironment.NODE_ENV = \'production\';\n});',
		'import {env as environment} from \'process\';\nimport test from \'node:test\';\ntest(\'reads config\', () => {\n\tenvironment.NODE_ENV = \'production\';\n});',
		'import {\'env\' as environment} from \'node:process\';\nimport test from \'node:test\';\ntest(\'reads config\', () => {\n\tenvironment.NODE_ENV = \'production\';\n});',

		// Local aliases
		inTest('const environment = process.env;\nenvironment.NODE_ENV = \'production\';'),
		inTest('const {env: environment} = process;\nenvironment.NODE_ENV = \'production\';'),

		// Subtests
		'import test from \'node:test\';\ntest(\'parent\', async t => {\n\tawait t.test(\'child\', () => {\n\t\tprocess.env.NODE_ENV = \'production\';\n\t});\n});',
		'import test from \'node:test\';\ntest(\'parent\', async t => {\n\tawait t.test.only(\'child\', () => {\n\t\tprocess.env.NODE_ENV = \'production\';\n\t});\n});',

		// Mutating calls
		inTest('Object.assign(process.env, values);'),
		inTest('Object[\'assign\'](process.env, values);'),
		inTest('Object.defineProperty(process.env, \'NODE_ENV\', {value: \'production\'});'),
		inTest('Object.defineProperties(process.env, {NODE_ENV: {value: \'production\'}});'),
		inTest('Reflect.set(process.env, \'NODE_ENV\', \'production\');'),
		inTest('Reflect[\'set\'](process.env, \'NODE_ENV\', \'production\');'),
		inTest('Reflect.deleteProperty(process.env, \'NODE_ENV\');'),
		inTest('Reflect.defineProperty(process.env, \'NODE_ENV\', {value: \'production\'});'),
		'import {env} from \'node:process\';\nimport test from \'node:test\';\ntest(\'reads config\', () => {\n\tObject.assign(env, values);\n});',

		// TypeScript
		{
			code: inTest('(process.env as NodeJS.ProcessEnv).NODE_ENV = \'production\';'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: inTest('(process as NodeJS.Process).env.NODE_ENV = \'production\';'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});
