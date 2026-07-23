import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

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
		// Names that only look like the test patterns, in any casing. Case-variant names that do
		// match (`./TEST.js`) resolve to a test file on a case-insensitive file system and not on a
		// case-sensitive one, so their result is platform-dependent and cannot be snapshotted.
		'import \'./TESTS.js\';',
		'import \'./TESTING/helper.js\';',
		String.raw`import '.\\test\\helpers.js';`,
		String.raw`import '..\\example.test.js';`,
		'import \'../example.test.js\';',
		{
			code: 'import \'./helper.js\';',
			filename: 'source/parent.js',
		},
		'import value from \'/project/test/value.js\';',
		'import value from \'file:///project/test/value.js\';',
		'import \'./test/../value.js\';',
		'import \'./test%2fhelpers.js\';',
		'import \'./test%5chelpers.js\';',
		'import \'./example.%74est.js%\';',
		{
			code: 'import \'../../example.test.js\';',
			filename: 'source/parent.js',
		},
		// eslint-disable-next-line no-template-curly-in-string
		'import(`./${name}.test.js`);',
		'import(\'./value.test.js\' + suffix);',
		{
			code: 'import type {Value} from \'./value.test.ts\';',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'export type {Value} from \'./value.test.ts\';',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'export type * from \'./value.test.ts\';',
			languageOptions: {parser: parsers.typescript},
		},
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
		{
			code: 'import \'./helper.js\';',
			filename: 'test/parent.test.js',
		},
		{
			code: 'import \'../helper.js\';',
			filename: 'test/nested/parent.test.js',
		},
		'import(`./example.test.js`);',
		'import(`./example_test.js`);',
		'import(`./example-test.js`);',
		'export {value} from \'./example.test.js\';',
		'export {} from \'./example.test.js\';',
		'export * from \'./example.test.js\';',
		'import \'./example.test.jsx\';',
		{
			code: 'import \'./example.test.ts\';',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import \'./example.test.mts\';',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import \'./example.test.cts\';',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import \'./example.test.tsx\';',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import(\'./example.test.js\' as string);',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import {type Value, value} from \'./example.test.ts\';',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import {type Value} from \'./example.test.ts\';',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'export {type Value, value} from \'./example.test.ts\';',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'export {type Value} from \'./example.test.ts\';',
			languageOptions: {parser: parsers.typescript},
		},
	],
});
