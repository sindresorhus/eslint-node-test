import {resolveImports, parseTestCall} from './utils/node-test.js';
import isConditionalBranch from './utils/is-conditional-branch.js';
import isFunction from './ast/is-function.js';

const MESSAGE_ID = 'no-conditional-tests';

const messages = {
	[MESSAGE_ID]: 'Do not register a {{kind}} conditionally; it makes the suite structure non-deterministic.',
};

/*
Whether a conditional construct guards `node`, searching up to the enclosing function. Loops are
intentionally ignored: iterating to register tests is the idiomatic way to write table-driven tests
in `node:test`.
*/
function isConditionallyRegistered(node) {
	let current = node;
	let {parent} = current;
	while (parent) {
		if (isFunction(parent)) {
			return false;
		}

		if (isConditionalBranch(parent, current)) {
			return true;
		}

		current = parent;
		({parent} = current);
	}

	return false;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (!parsed) {
			return;
		}

		if (!isConditionallyRegistered(node)) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
			data: {kind: parsed.kind},
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow conditionally registering tests, suites, and hooks.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
