import {resolveImports, parseTestCall, getTestOptions} from './utils/node-test.js';

const MESSAGE_ID = 'no-unknown-test-options';

const messages = {
	[MESSAGE_ID]: '`{{name}}` is not a recognized {{kind}} option.',
};

/*
The option keys `node:test` recognizes. An unknown key is silently ignored, so a typo like
`{skp: true}` quietly runs the test as normal. This list tracks the runner and may need
updating as `node:test` gains options.

`name` belongs here rather than in an object-form-only allowance: `node:test` names a test after
`options.name` whenever there is one, so `test('a', {name: 'b'}, fn)` is called `b`. A hook has no
title and no descriptor form, so `before({name: 'x'})` really is an unknown key.
*/
const TEST_OPTIONS = new Set(['concurrency', 'expectFailure', 'name', 'only', 'plan', 'signal', 'skip', 'tags', 'timeout', 'todo']);
const HOOK_OPTIONS = new Set(['signal', 'timeout']);

/*
`node:test` reads `fn` from an options object wherever it sits, so `test({name, fn})` and
`test(name, {fn})` both run that function.
*/
const ALWAYS_KNOWN_KEYS = new Set(['fn']);

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	context.on('CallExpression', function * (node) {
		const parsed = parseTestCall(node, imports);
		if (!parsed) {
			return;
		}

		const options = getTestOptions(node);
		if (!options) {
			return;
		}

		const known = parsed.kind === 'hook' ? HOOK_OPTIONS : TEST_OPTIONS;

		for (const property of options.properties) {
			if (property.type !== 'Property' || property.computed) {
				continue;
			}

			let name;
			if (property.key.type === 'Identifier') {
				name = property.key.name;
			} else if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
				name = property.key.value;
			} else {
				continue;
			}

			if (!known.has(name) && !ALWAYS_KNOWN_KEYS.has(name)) {
				yield {
					node: property.key,
					messageId: MESSAGE_ID,
					data: {name, kind: parsed.kind},
				};
			}
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow unknown options in test and hook option objects.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
