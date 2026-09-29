import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withTestImport = code => `import test from 'node:test';\n${code}`;
const withBeforeEachImport = code => `import {beforeEach} from 'node:test';\n${code}`;
const withAfterEachImport = code => `import {afterEach} from 'node:test';\n${code}`;
const inTest = code => withTestImport(`test('reads config', t => {\n\t${code}\n});`);

test.snapshot({
	valid: [
		// A suite body and a helper the test body calls are separate cases
		'import {describe} from \'node:test\';\nconst body = () => { process.env.NODE_ENV = \'production\'; };\ndescribe(\'s\', body);',
		'import {test} from \'node:test\';\nconst body = () => { process.env.NODE_ENV = \'production\'; };\ntest(\'a\', () => { body(); });',

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

		// Suite (`describe`) bodies are not flagged — only test and subtest callbacks
		'import {describe} from \'node:test\';\ndescribe(\'s\', () => { process.env.NODE_ENV = \'test\'; });',

		// A mutating call needs an object to mutate
		inTest('Object.assign();'),
		// A `for…of` over `process.env` reads it; only the loop target mutates
		inTest('for (const value of process.env) {}'),
		// A block-scoped `process` is a different binding than the import
		'import process from \'node:process\';\nimport test from \'node:test\';\ntest(\'reads config\', () => {\n\tconst process = other;\n\tprocess.env.NODE_ENV = \'production\';\n});',
		// Hooks are out of scope however they are declared, so `test.beforeEach` too
		'import test from \'node:test\';\ntest.beforeEach(() => {\n\tprocess.env.NODE_ENV = \'production\';\n});',

		// A local `globalThis` / `global` is some other object, the same way a local `process` is
		withTestImport('test(\'reads config\', function (globalThis) { globalThis.process.env.NODE_ENV = \'production\'; });'),
		withTestImport('test(\'reads config\', function (global) { global.process.env.NODE_ENV = \'production\'; });'),
		withTestImport('test(\'reads config\', (globalThis) => { globalThis.process.env.NODE_ENV = \'production\'; });'),
		inTest('const globalThis = {process: {env: {}}};\nglobalThis.process.env.NODE_ENV = \'production\';'),
		'// An unrelated object\'s `test` method is not a registration, so its callback is not a test body\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'function body() {\n'
		+ '	process.env.X = \'1\';\n'
		+ '}\n'
		+ 'foo.test(\'a\', body);',
	],
	invalid: [
		// A test body the call names out of line is still a test body
		withTestImport('function body() { process.env.NODE_ENV = \'production\'; }\ntest(\'a\', body);'),
		withTestImport('const body = () => { process.env.NODE_ENV = \'production\'; };\ntest(\'a\', body);'),
		withTestImport('const body = () => { process.env.NODE_ENV = \'production\'; };\ntest(\'a\', {fn: body});'),

		// A subtest's options object is evaluated inside the parent test's callback, so a mutation there is in a test body and leaks into every later test just the same
		withTestImport('test(\'parent\', t => {\n\tt.test(\'child\', {skip: (process.env.NODE_ENV = \'production\', false)}, () => {});\n});'),
		// A `getTestContext()` subtest is a callback like any other
		'import {test, getTestContext} from \'node:test\';\ntest(\'parent\', () => {\n\tgetTestContext().test(\'child\', () => {\n\t\tprocess.env.NODE_ENV = \'production\';\n\t});\n});',
		'import {test, getTestContext} from \'node:test\';\ntest(\'parent\', () => {\n\tgetTestContext().test(\'child\', {skip: (process.env.NODE_ENV = \'production\', false)}, () => {});\n});',
		withTestImport('test(\'parent\', t => {\n\tt.test(\'child\', (process.env.NODE_ENV = \'production\', \'child\'), () => {});\n});'),
		withTestImport('test(\'parent\', t => {\n\tt.test(\'child\', () => {\n\t\tt.test(\'grandchild\', {skip: (process.env.NODE_ENV = \'production\', false)}, () => {});\n\t});\n});'),

		// Direct member mutations
		inTest('process.env.NODE_ENV = \'production\';'),
		// `globalThis.process` / `global.process` are the same object as the bare global
		inTest('globalThis.process.env.NODE_ENV = \'production\';'),
		inTest('global.process.env.NODE_ENV = \'production\';'),
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

		// A defaulted context parameter is still the test context, exactly as in the other rules
		'import {test} from \'node:test\';\ntest(\'sub\', (t = getTestContext()) => {\n\tt.test(\'child\', () => {\n\t\tprocess.env.NODE_ENV = \'production\';\n\t});\n});',

		// `process.env` is a truthy object, so a defensive fallback still evaluates to it
		inTest('const environment = process.env ?? {};\nenvironment.NODE_ENV = \'production\';'),
		inTest('const environment = process.env || {};\nenvironment.NODE_ENV = \'production\';'),

		// A template literal with no expressions is a static key too
		inTest('process.env[`NODE_ENV`] = \'production\';'),
		// Destructuring binds the environment object just as an alias does, defaulted or not
		inTest('const {env = {}} = process;\nenv.NODE_ENV = \'production\';'),
		inTest('const {env} = process;\nenv.NODE_ENV = \'production\';'),
		// A rest element in a destructuring target writes into the environment object
		inTest('[...process.env] = values;'),
		// A logical assignment is still an assignment to the member
		inTest('process.env.NODE_ENV ||= \'production\';'),
		// A delete through an alias is still a delete of the environment
		inTest('const environment = process.env;\ndelete environment.NODE_ENV;'),
		{
			code: inTest('process!.env.NODE_ENV = \'production\';'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: inTest('(process.env satisfies Record<string, string>).NODE_ENV = \'production\';'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: inTest('Object.assign(process.env as NodeJS.ProcessEnv, values);'),
			languageOptions: {parser: parsers.typescript},
		},
		'// A body the call names out of line is the subtest\'s body\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'const body = () => {\n'
		+ '\tprocess.env.X = \'1\';\n'
		+ '};\n'
		+ 'test(\'a\', t => {\n'
		+ '\tt.test(\'sub\', body);\n'
		+ '});',
		// A subtest registered from a hook is read as a test in every form: Node runs the `t.test()` form from a `beforeEach`, and the `getTestContext()` form is read the same way, although in a hook it registers on the hook's owner and, awaited, never completes
		withBeforeEachImport('beforeEach(async t => {\n\tawait t.test(\'sub\', () => {\n\t\tprocess.env.X = \'1\';\n\t});\n});'),
		'import {beforeEach, getTestContext} from \'node:test\';\n'
		+ 'beforeEach(async () => {\n'
		+ '\tawait getTestContext().test(\'sub\', () => {\n'
		+ '\t\tprocess.env.X = \'1\';\n'
		+ '\t});\n'
		+ '});',
	],
});
