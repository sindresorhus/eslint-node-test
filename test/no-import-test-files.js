import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);
const isCaseInsensitiveFileSystem = process.platform === 'darwin' || process.platform === 'win32';
const caseSensitiveTestFile = 'import \'./EXAMPLE.TEST.JS\';';
const validCaseSensitiveTestFiles = isCaseInsensitiveFileSystem ? [] : [caseSensitiveTestFile];
const invalidCaseInsensitiveTestFiles = isCaseInsensitiveFileSystem ? [caseSensitiveTestFile] : [];

test.snapshot({
	valid: [
		'import value from \'./value.js\';',
		'import value from \'./test/value.json\';',
		'import value from \'package-test\';',
		'import value from \'package/test.js\';',
		'import value from \'./node_modules/package/test/helpers.js\';',
		'import value from \'./.test.js\';',
		'import value from \'./test/.helper.js\';',
		'import value from \'./.fixtures/test/helper.js\';',
		'import value from \'./test/%2e%2e/value.js\';',
		String.raw`import '.\\test\\helpers.js';`,
		String.raw`import '..\\example.test.js';`,
		'import value from \'/project/test/value.js\';',
		'import value from \'file:///project/test/value.js\';',
		'import \'./test/../value.js\';',
		// eslint-disable-next-line no-template-curly-in-string
		'import(`./${name}.test.js`);',
		'import(\'./value.test.js\' + suffix);',
		{
			code: 'import type {Value} from \'./value.test.ts\';',
			options: [{extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts']}],
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import {type Value} from \'./value.test.ts\';',
			options: [{extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts']}],
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'export type {Value} from \'./value.test.ts\';',
			options: [{extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts']}],
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'export {type Value} from \'./value.test.ts\';',
			options: [{extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts']}],
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'export type * from \'./value.test.ts\';',
			options: [{extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts']}],
			languageOptions: {parser: parsers.typescript},
		},
		...validCaseSensitiveTestFiles,
	],
	invalid: [
		'import \'./test.js\';',
		'import \'./test-example.cjs\';',
		'import \'./example.test.mjs\';',
		'import \'./example_test.js\';',
		'import \'./example-test.js\';',
		'import \'./test/helpers.js\';',
		String.raw`import './test\\helpers.js';`,
		String.raw`import './example\\thing.test.js';`,
		'import \'./%74est/helpers.js\';',
		'import \'./example.%74est.js\';',
		'import \'./node_modules/%2e%2e/test/helpers.js\';',
		'import \'./test/helpers.js?direct#source\';',
		'import(`./example.test.js`);',
		'import(`./example_test.js`);',
		'import(`./example-test.js`);',
		'export {value} from \'./example.test.js\';',
		'export * from \'./example.test.js\';',
		{
			code: 'import \'./example.test.ts\';',
			options: [{extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts']}],
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import(\'./example.test.js\' as string);',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import {type Value, value} from \'./example.test.ts\';',
			options: [{extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts']}],
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'export {type Value, value} from \'./example.test.ts\';',
			options: [{extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts']}],
			languageOptions: {parser: parsers.typescript},
		},
		...invalidCaseInsensitiveTestFiles,
	],
});
