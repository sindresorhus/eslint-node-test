import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		// Not a test file
		'test("a", () => {}); test("a", () => {});',
		// Unique titles
		'import test from "node:test";\ntest("a", () => {});\ntest("b", () => {});',
		// Single test
		'import test from "node:test";\ntest("a", () => {});',
		// Dynamic titles — can't check statically
		// eslint-disable-next-line no-template-curly-in-string
		'import test from "node:test";\ntest(`test ${x}`, () => {});\ntest(`test ${x}`, () => {});',
		// Hooks — no title tracking
		'import {before, beforeEach} from "node:test";\nbefore(() => {});\nbefore(() => {});',
		// Same title in different describe scopes is valid
		'import test from "node:test";\nimport {describe} from "node:test";\ndescribe("suite a", () => { test("same", () => {}); });\ndescribe("suite b", () => { test("same", () => {}); });',
		// Same title at top-level and inside a describe is valid
		'import test from "node:test";\nimport {describe} from "node:test";\ntest("same", () => {});\ndescribe("suite", () => { test("same", () => {}); });',
		// Unique suite titles
		'import {describe} from "node:test";\ndescribe("a", () => {});\ndescribe("b", () => {});',
		// Named imports
		'import {it} from "node:test";\nit("a", () => {});\nit("b", () => {});',
		// Renamed import
		'import {test as t} from "node:test";\nt("a", () => {});\nt("b", () => {});',
		// `node:test` names a test after `options.name`, so two tests sharing a positional string are not duplicates
		'import test from "node:test";\ntest("a", () => {});\ntest("a", {name: "b"}, () => {});',
		// Same for the object form, where the descriptor wins over every later argument
		'import test from "node:test";\ntest({name: "a"}, () => {});\ntest({name: "b"}, {name: "a"}, () => {});',

		// An empty title is not the name the runner uses: it falls back to the callback's function name
		'import test from \'node:test\';\ntest(\'\', function alpha() {});\ntest(\'\', function beta() {});',
		'import test from \'node:test\';\ntest(\'a\', {name: \'\'}, function alpha() {});\ntest(\'b\', {name: \'\'}, function beta() {});',
		// A subtest is in its parent test’s own scope, so sharing the parent’s title is fine
		'import test from \'node:test\';\ntest(\'a\', t => { t.test(\'a\', () => {}); });',
		'import test from \'node:test\';\ntest(\'a\', t => { t.test(\'b\', () => {}); });\ntest(\'b\', () => {});',
		// A nested subtest is one level deeper again
		'import test from \'node:test\';\ntest(\'a\', t => { t.test(\'b\', t2 => { t2.test(\'b\', () => {}); }); });',
		'import test, {getTestContext} from \'node:test\';\ntest(\'a\', () => { getTestContext().test(\'a\', () => {}); });',

		// A callback the call names out of line is the test's body wherever it is declared, so its own tests are a scope of their own
		'import test from \'node:test\';\nconst body = () => { test(\'a\', () => {}); };\ntest(\'a\', body);',
		'import test from \'node:test\';\ntest(\'a\', body);\nconst body = () => { test(\'a\', () => {}); };',
		'import test from \'node:test\';\nconst body = () => { test(\'a\', () => {}); };\ntest({name: \'a\', fn: body});',
		'import test from \'node:test\';\nconst body = () => { test(\'a\', () => {}); };\ntest(\'a\', {fn: body});',
		'import test from \'node:test\';\nfunction body() { test(\'a\', () => {}); }\ntest(\'a\', body);',
		'import {describe, test} from \'node:test\';\nconst body = () => { test(\'a\', () => {}); };\ndescribe(\'s\', body);',
		// Two out-of-line bodies are two scopes, so the same title in each is fine
		'import test from \'node:test\';\nconst first = () => { test(\'a\', () => {}); };\nconst second = () => { test(\'a\', () => {}); };\ntest(\'x\', first);\ntest(\'y\', second);',

		// A descriptor with no `name` gives the test no title this rule can read
		'import test from \'node:test\';\ntest({skip: true}, () => {});\ntest({skip: true}, () => {});',
		// A spread in the options slot could add a `name`, so the positional title is not the one the runner uses
		'import test from \'node:test\';\ntest("a", {...rest}, () => {});\ntest("a", {...rest}, () => {});',
		// A function in the first position is the implementation, not a title
		'import test from \'node:test\';\ntest(() => {});\ntest(() => {});',

		// `options.name` still wins from an options slot the rule cannot see into
		'import {test} from \'node:test\';\nconst options = {name: \'other\'};\ntest(\'a\', options, () => {});\ntest(\'a\', () => {});',
	],
	invalid: [
		// Duplicate top-level titles
		'import test from "node:test";\ntest("a", () => {});\ntest("a", () => {});',
		// Duplicate with `it`
		'import {it} from "node:test";\nit("a", () => {});\nit("a", () => {});',
		// Duplicate suite titles
		'import {describe} from "node:test";\ndescribe("a", () => {});\ndescribe("a", () => {});',
		// Duplicate inside a describe scope
		'import test from "node:test";\nimport {describe} from "node:test";\ndescribe("suite", () => { test("same", () => {}); test("same", () => {}); });',
		// Mixed test/it with same title
		'import test from "node:test";\nimport {it} from "node:test";\ntest("a", () => {});\nit("a", () => {});',
		// A `describe` and a `test` sharing a title in the same scope is also a duplicate
		'import test, {describe} from "node:test";\ndescribe("a", () => {});\ntest("a", () => {});',
		// Template literal duplicates string literal
		'import test from "node:test";\ntest("a", () => {});\ntest(`a`, () => {});',
		// Renamed import
		'import {test as myTest} from "node:test";\nmyTest("a", () => {});\nmyTest("a", () => {});',
		// Namespace import
		'import * as nodeTest from "node:test";\nnodeTest.test("a", () => {});\nnodeTest.test("a", () => {});',
		// A chained modifier (`test.only`) still shares the title namespace with a plain `test`
		'import test from "node:test";\ntest.only("a", () => {});\ntest("a", () => {});',
		// `suite` alias duplicates a `describe` title
		'import {describe, suite} from "node:test";\ndescribe("a", () => {});\nsuite("a", () => {});',
		// TypeScript
		{
			code: 'import test from "node:test";\ntest("a", () => {});\ntest("a", () => {});',
			languageOptions: {parser: parsers.typescript},
		},
		// Duplicate `options.name`: the title each test actually runs under
		'import test from "node:test";\ntest("a", {name: "same"}, () => {});\ntest("b", {name: "same"}, () => {});',
		// Duplicate sibling subtests inside one test callback
		'import test from "node:test";\ntest("parent", t => { t.test("same", () => {}); t.test("same", () => {}); });',
		// A subtest and a test registered in the same test callback
		'import test from "node:test";\ntest("parent", t => { t.test("a", () => {}); t.test("a", () => {}); });',
		// Duplicates inside an out-of-line callback are still duplicates
		'import test from "node:test";\nconst body = () => { test("a", () => {}); test("a", () => {}); };\ntest("x", body);',
		'import {describe, test} from "node:test";\nconst body = () => { test("a", () => {}); test("a", () => {}); };\ndescribe("s", body);',
		// A function that is not a callback shares the enclosing scope
		'import test from "node:test";\nconst body = () => { test("a", () => {}); test("a", () => {}); };\nrun(body);',
		'import test from "node:test";\nconst body = () => { test("a", () => {}); };\ntest({name: "a", other: body});',
		// A concise callback body is still a scope of its own, so only the outer titles are duplicates
		'import test from "node:test";\ntest("p", () => test("x", () => {}));\ntest("p", () => test("x", () => {}));',
		// A positional title that matches another test's `options.name` is the name both tests run under
		'import test from "node:test";\ntest("x", () => {});\ntest("y", {name: "x"}, () => {});',
		// TypeScript: a wrapper on the title does not hide it
		{
			code: 'import test from "node:test";\ntest("a" as const, () => {});\ntest("a" as const, () => {});',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from "node:test";\ntest("a" satisfies string, () => {});\ntest("a" satisfies string, () => {});',
			languageOptions: {parser: parsers.typescript},
		},
		'// A computed key that folds to a constant cannot hide `name`, so both tests are named `dup`\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'test(\'dup\', {skip: true}, () => {});\n'
		+ 'test(\'dup\', {[\'skip\']: true}, () => {});',
		'// The subtests of a test body the call names out of line\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'function body(t) {\n'
		+ '	t.test(\'s\', () => {});\n'
		+ '	t.test(\'s\', () => {});\n'
		+ '}\n'
		+ 'test(\'a\', body);',
		'// A function in the options slot is the implementation, and `node:test` never reads a `name` off it\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'function body() {}\n'
		+ 'test(\'a\', body);\n'
		+ 'test(\'a\', body);',
		'// The last argument of a two-argument call is the implementation, even when it is imported\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'import {run} from \'./helpers.js\';\n'
		+ 'test(\'foo\', run);\n'
		+ 'test(\'foo\', run);',
	],
});
