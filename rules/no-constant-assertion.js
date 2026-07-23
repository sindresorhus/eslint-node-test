import {getStaticValue} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import {isRegexLiteral} from './ast/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-constant-assertion';

const messages = {
	[MESSAGE_ID]: 'This assertion has a constant outcome, so it does not test code behavior.',
};

const COMPARISON_METHODS = new Set([
	'equal',
	'notEqual',
	'strictEqual',
	'notStrictEqual',
	'deepEqual',
	'notDeepEqual',
	'deepStrictEqual',
	'notDeepStrictEqual',
]);

const MATCH_METHODS = new Set([
	'match',
	'doesNotMatch',
]);

function isStaticArgument(node, sourceCode) {
	if (!node || node.type === 'SpreadElement') {
		return false;
	}

	node = unwrapTypeScriptExpression(node);

	return getStaticValue(node, sourceCode.getScope(node)) !== null;
}

function areStaticArguments(nodes, sourceCode) {
	return nodes.every(node => isStaticArgument(node, sourceCode));
}

function isStaticRegexLiteral(node) {
	if (!node || node.type === 'SpreadElement') {
		return false;
	}

	return isRegexLiteral(unwrapTypeScriptExpression(node));
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const {sourceCode} = context;
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const assertion = parseSupportedAssertionCall(node, imports, tracker);
		if (!assertion) {
			return;
		}

		if (node.arguments.some(argument => argument.type === 'SpreadElement')) {
			return;
		}

		const {method} = assertion;
		const [firstArgument, secondArgument] = node.arguments;
		let isConstant = false;

		if (method === 'ok' || method === 'ifError') {
			isConstant = isStaticArgument(firstArgument, sourceCode);
		} else if (COMPARISON_METHODS.has(method)) {
			isConstant = areStaticArguments([firstArgument, secondArgument], sourceCode);
		} else if (MATCH_METHODS.has(method)) {
			isConstant = isStaticArgument(firstArgument, sourceCode) && isStaticRegexLiteral(secondArgument);
		}

		if (!isConstant) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
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
			description: 'Disallow assertions with constant outcomes.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
