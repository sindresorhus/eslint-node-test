import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withStrictAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withBareAssert = code => `import assert from 'assert';\n${code}`;
const withBareStrictAssert = code => `import assert from 'assert/strict';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;
const withStrictNamedImport = (methods, code) => `import {${methods}} from 'node:assert/strict';\n${code}`;
const assertStyle = {style: 'assert'};

test.snapshot({
	valid: [
		// Default: prefer `assert.ok(…)`
		withAssert('assert.ok(value);'),
		withAssert('assert.ok(value, "message");'),
		withAssert('assert.strictEqual(actual, expected);'),

		// Custom option: prefer `assert(…)`
		{code: withAssert('assert(value);'), options: [assertStyle]},
		{code: withAssert('assert(value, "message");'), options: [assertStyle]},

		// Unrelated globals and non-assert imports
		'assert.ok(value);',
		'import assert from "node:other";\nassert.ok(value);',

		// Namespace import is not callable
		'import * as assert from \'node:assert\';\nassert.ok(value);',
		'import * as assert from \'node:assert\';\nassert(value);',

		// Named `ok` import would require import rewrites
		withNamedImport('ok', 'ok(value);'),
		withNamedImport('ok as assertOk', 'assertOk(value);'),

		// CommonJS is not supported by this plugin's import resolver
		'const assert = require("node:assert");\nassert.ok(value);',
		'const assert = require("node:assert");\nassert(value);',

		// Non-simple member forms are ignored
		withAssert('assert["ok"](value);'),
		withAssert('assert?.ok(value);'),
		withAssert('assert.ok?.(value);'),
		withAssert('(assert).ok(value);'),
		withAssert('(assert.ok)(value);'),
		withAssert('wrapper.assert.ok(value);'),
		withAssert('assert?.(value);'),
		withAssert('(assert)(value);'),

		// `t.assert` is an object, not a callable function
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.ok(value); });',

		// Shadowed binding
		withAssert('function fn(assert) { assert.ok(value); }'),
		withAssert('function fn(assert) { assert(value); }'),

		// Type-only imports do not create value bindings
		{
			code: 'import type assert from \'node:assert\';\nassert.ok(value);',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import {type strict as assert} from \'node:assert\';\nassert.ok(value);',
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		// Default: prefer `assert.ok(…)`
		withAssert('assert(value);'),
		withAssert('assert(value, "message");'),
		withAssert('assert /* comment */ (value);'),
		withStrictAssert('assert(value);'),
		withBareAssert('assert(value);'),
		withBareStrictAssert('assert(value);'),
		'import check from \'node:assert\';\ncheck(value);',

		// Callable named imports
		withNamedImport('default as assert', 'assert(value);'),
		withNamedImport('strict as assert', 'assert(value);'),
		'import {strict as strictAssert} from \'node:assert\';\nstrictAssert(value);',
		withStrictNamedImport('default as assert', 'assert(value);'),
		withStrictNamedImport('strict as assert', 'assert(value);'),
		'import {strict as assert} from \'assert/strict\';\nassert(value);',

		// Custom option: prefer `assert(…)`
		{code: withAssert('assert.ok(value);'), options: [assertStyle]},
		{code: withAssert('assert.ok(value, "message");'), options: [assertStyle]},
		{code: withStrictAssert('assert.ok(value);'), options: [assertStyle]},
		{code: withBareAssert('assert.ok(value);'), options: [assertStyle]},
		{code: withBareStrictAssert('assert.ok(value);'), options: [assertStyle]},
		{code: withNamedImport('default as assert', 'assert.ok(value);'), options: [assertStyle]},
		{code: withNamedImport('strict as assert', 'assert.ok(value);'), options: [assertStyle]},
		{code: 'import check from \'node:assert\';\ncheck.ok(value);', options: [assertStyle]},
		{code: withStrictNamedImport('default as assert', 'assert.ok(value);'), options: [assertStyle]},
		{code: withStrictNamedImport('strict as assert', 'assert.ok(value);'), options: [assertStyle]},
		{code: 'import {strict as assert} from \'assert/strict\';\nassert.ok(value);', options: [assertStyle]},

		// Comments inside the callee are reported without an autofix
		{code: withAssert('assert /* comment */ .ok(value);'), options: [assertStyle]},

		// TypeScript
		{
			code: withAssert('assert(value as boolean);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.ok(value as boolean);'),
			options: [assertStyle],
			languageOptions: {parser: parsers.typescript},
		},
	],
});
