import {resolveImports, parseTestCall, createSuiteDepthTracker} from './utils/node-test.js';
import {getEnclosingFunction} from './utils/index.js';

const MESSAGE_ID_NOT_WRAPPED = 'require-top-level-describe/not-wrapped';
const MESSAGE_ID_TOO_MANY = 'require-top-level-describe/too-many';

const messages = {
	[MESSAGE_ID_NOT_WRAPPED]: 'A {{kind}} must be placed inside a top-level `describe`.',
	[MESSAGE_ID_TOO_MANY]: 'There should be no more than {{max}} top-level `describe` blocks in a file.',
};

// Array methods that run their first argument once per item, where the call is written.
const ITERATION_METHODS = new Set(['forEach', 'map', 'flatMap']);

function isIterationCallback(node) {
	const {parent} = node;
	return parent?.type === 'CallExpression'
		&& parent.arguments[0] === node
		&& parent.callee.type === 'MemberExpression'
		&& !parent.callee.computed
		&& ITERATION_METHODS.has(parent.callee.property.name);
}

/*
Whether a registration runs directly in the module scope. An array-iteration callback runs where it is written, so a registration in `[1, 2].forEach(n => …)` is as top-level as one in a `for…of` body, while any other function (a helper, a hook body, a class method) may well run inside a suite.
*/
function isInModuleScope(node) {
	for (let function_ = getEnclosingFunction(node); function_; function_ = getEnclosingFunction(function_)) {
		if (!isIterationCallback(function_)) {
			return false;
		}
	}

	return true;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const maxTopLevelDescribes = context.options[0]?.maxTopLevelDescribes;

	const tracker = createSuiteDepthTracker();
	let topLevelDescribeCount = 0;

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (!parsed) {
			return;
		}

		// Syntactic depth alone would call a `describe` inside a helper function or a hook
		// top-level, since neither is nested in another suite. A registration is top-level only
		// when it sits directly in the module scope, or in an array-iteration callback there.
		const isTopLevel = tracker.depth === 0 && isInModuleScope(node);

		let problem;
		if (isTopLevel) {
			if (parsed.kind === 'test' || parsed.kind === 'hook') {
				problem = {
					node,
					messageId: MESSAGE_ID_NOT_WRAPPED,
					data: {kind: parsed.kind === 'hook' ? 'hook' : 'test'},
				};
			} else if (parsed.kind === 'suite') {
				topLevelDescribeCount += 1;
				if (maxTopLevelDescribes !== undefined && topLevelDescribeCount > maxTopLevelDescribes) {
					problem = {
						node,
						messageId: MESSAGE_ID_TOO_MANY,
						data: {max: maxTopLevelDescribes},
					};
				}
			}
		}

		if (parsed.kind === 'suite') {
			tracker.enterSuite(node);
		}

		return problem;
	});

	context.onExit('CallExpression', node => {
		tracker.exitSuite(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Require tests and hooks to be inside a top-level `describe`.',
			recommended: false,
		},
		schema: [
			{
				type: 'object',
				properties: {
					maxTopLevelDescribes: {
						type: 'integer',
						minimum: 1,
						description: 'The maximum number of top-level `describe` blocks allowed in a file.',
					},
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{}],
		messages,
		languages: ['js/js'],
	},
};

export default config;
