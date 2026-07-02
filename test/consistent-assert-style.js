import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withStrictAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withBareAssert = code => `import assert from 'assert';\n${code}`;
const withBareStrictAssert = code => `import assert from 'assert/strict';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;
const withStrictNamedImport = (methods, code) => `import {${methods}} from 'node:assert/strict';\n${code}`;
const assertOkStyle = {style: 'assert-ok'};

test.snapshot({
	valid: [
		// Default: prefer `assert(…)`
		withAssert('assert(value);'),
		withAssert('assert(value, "message");'),
		withAssert('assert.strictEqual(actual, expected);'),

		// Custom option: prefer `assert.ok(…)`
		{code: withAssert('assert.ok(value);'), options: [assertOkStyle]},
		{code: withAssert('assert.ok(value, "message");'), options: [assertOkStyle]},

		// Unrelated globals and non-assert imports
		'assert.ok(value);',
		'import assert from "node:other";\nassert.ok(value);',

		// Namespace import is not callable
		'import * as assert from \'node:assert\';\nassert.ok(value);',
		{code: 'import * as assert from \'node:assert\';\nassert(value);', options: [assertOkStyle]},

		// Named `ok` import would require import rewrites
		withNamedImport('ok', 'ok(value);'),
		withNamedImport('ok as assertOk', 'assertOk(value);'),

		// CommonJS is not supported by this plugin's import resolver
		'const assert = require("node:assert");\nassert.ok(value);',
		{code: 'const assert = require("node:assert");\nassert(value);', options: [assertOkStyle]},

		// Non-simple member forms are ignored
		withAssert('assert["ok"](value);'),
		withAssert('assert?.ok(value);'),
		withAssert('assert.ok?.(value);'),
		withAssert('(assert).ok(value);'),
		withAssert('(assert.ok)(value);'),
		withAssert('wrapper.assert.ok(value);'),
		{code: withAssert('assert?.(value);'), options: [assertOkStyle]},
		{code: withAssert('(assert)(value);'), options: [assertOkStyle]},

		// `t.assert` is an object, not a callable function
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.ok(value); });',

		// Shadowed binding
		withAssert('function fn(assert) { assert.ok(value); }'),
		{code: withAssert('function fn(assert) { assert(value); }'), options: [assertOkStyle]},

		// Type-only imports do not create value bindings
		{
			code: 'import type assert from \'node:assert\';\nassert.ok(value);',
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		// Default: prefer `assert(…)`
		withAssert('assert.ok(value);'),
		withAssert('assert.ok(value, "message");'),
		withStrictAssert('assert.ok(value);'),
		withBareAssert('assert.ok(value);'),
		withBareStrictAssert('assert.ok(value);'),

		// Callable named imports
		withNamedImport('default as assert', 'assert.ok(value);'),
		withNamedImport('strict as assert', 'assert.ok(value);'),
		'import check from \'node:assert\';\ncheck.ok(value);',
		withStrictNamedImport('default as assert', 'assert.ok(value);'),
		withStrictNamedImport('strict as assert', 'assert.ok(value);'),
		'import {strict as assert} from \'assert/strict\';\nassert.ok(value);',

		// Custom option: prefer `assert.ok(…)`
		{code: withAssert('assert(value);'), options: [assertOkStyle]},
		{code: withAssert('assert(value, "message");'), options: [assertOkStyle]},
		{code: withStrictAssert('assert(value);'), options: [assertOkStyle]},
		{code: withBareAssert('assert(value);'), options: [assertOkStyle]},
		{code: withBareStrictAssert('assert(value);'), options: [assertOkStyle]},
		{code: 'import check from \'node:assert\';\ncheck(value);', options: [assertOkStyle]},
		{code: withNamedImport('default as assert', 'assert(value);'), options: [assertOkStyle]},
		{code: withNamedImport('strict as assert', 'assert(value);'), options: [assertOkStyle]},
		{code: 'import {strict as strictAssert} from \'node:assert\';\nstrictAssert(value);', options: [assertOkStyle]},
		{code: withStrictNamedImport('default as assert', 'assert(value);'), options: [assertOkStyle]},
		{code: withStrictNamedImport('strict as assert', 'assert(value);'), options: [assertOkStyle]},
		{
			code: 'import {strict as assert} from \'assert/strict\';\nassert(value);',
			options: [assertOkStyle],
		},

		// Comments inside the callee are reported without an autofix
		withAssert('assert /* comment */ .ok(value);'),

		// TypeScript
		{
			code: withAssert('assert.ok(value as boolean);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert(value as boolean);'),
			options: [assertOkStyle],
			languageOptions: {parser: parsers.typescript},
		},
	],
});
