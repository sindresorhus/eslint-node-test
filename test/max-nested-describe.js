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

		// TypeScript
		{
			code: nest(6),
			languageOptions: {parser: parsers.typescript},
		},
	],
});
