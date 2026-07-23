import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import {unwrapExpression} from './utils/index.js';

const MESSAGE_ID_ERROR = 'no-assert-throws-call/error';
const MESSAGE_ID_SUGGESTION = 'no-assert-throws-call/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: '`{{method}}()` expects a function callback. This call runs before the assertion can catch it.',
	[MESSAGE_ID_SUGGESTION]: 'Wrap the call in an arrow function.',
};

function isBindCall(node) {
	const {callee} = node;

	return callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.property.type === 'Identifier'
		&& callee.property.name === 'bind';
}

function isFunctionConstructorCall(node) {
	return node.callee.type === 'Identifier' && node.callee.name === 'Function';
}

function isFunctionProducingCall(node) {
	return isBindCall(node) || isFunctionConstructorCall(node);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const assertion = parseSupportedAssertionCall(node, imports, tracker);
		if (!assertion || assertion.method !== 'throws') {
			return;
		}

		const [firstArgument] = node.arguments;
		if (!firstArgument || firstArgument.type === 'SpreadElement') {
			return;
		}

		const call = unwrapExpression(firstArgument);
		if (call.type !== 'CallExpression' || isFunctionProducingCall(call)) {
			return;
		}

		return {
			node: firstArgument,
			messageId: MESSAGE_ID_ERROR,
			data: {method: assertion.method},
			suggest: [
				{
					messageId: MESSAGE_ID_SUGGESTION,
					fix: fixer => fixer.replaceText(firstArgument, `() => ${sourceCode.getText(firstArgument)}`),
				},
			],
		};
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow calling the function passed to `assert.throws()`.',
			recommended: 'unopinionated',
		},
		hasSuggestions: true,
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
