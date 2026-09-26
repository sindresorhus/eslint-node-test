import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const head = 'import {describe, it} from \'node:test\';\n';

const nest = depth => {
	let inner = 'it("t", () => {});';
	for (let level = depth; level >= 1; level -= 1) {
		inner = `describe("d${level}", () => { ${inner} });`;
	}

	return head + inner;
};

test.snapshot({
	valid: [
		// Not a test file
		'describe("a", () => { describe("b", () => {}); });',

		// At or under the default limit of 5
		nest(1),
		nest(3),
		nest(5),

		// Over the default limit, but allowed by a higher `max`
		{code: nest(6), options: [{max: 10}]},
	],
	invalid: [
		// One level past the default limit
		nest(6),

		// Two levels past — both are reported
		nest(7),

		// Custom lower limit
		{code: nest(3), options: [{max: 2}]},

		// The lowest `max` the schema allows
		{code: 'import {describe} from \'node:test\';\ndescribe("a", () => { describe("b", () => { describe("c", () => {}); }); });', options: [{max: 1}]},

		// Depth is per-branch, so only the second level of each branch is over the limit
		{
			code: 'import {describe} from \'node:test\';\ndescribe("a", () => { describe("a1", () => {}); });\ndescribe("b", () => { describe("b1", () => {}); });',
			options: [{max: 1}],
		},

		// A suite nested in a test body still counts toward the depth
		{
			code: 'import {describe, test} from \'node:test\';\ntest("t", () => { describe("a", () => { describe("b", () => {}); }); });',
			options: [{max: 1}],
		},

		// Namespace import
		{
			code: 'import * as nodeTest from \'node:test\';\nnodeTest.describe("a", () => { nodeTest.describe("b", () => {}); });',
			options: [{max: 1}],
		},

		// TypeScript
		{
			code: nest(6),
			languageOptions: {parser: parsers.typescript},
		},
	],
});
