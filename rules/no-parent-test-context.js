import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getSubtestReceiver,
} from './utils/node-test.js';

/**
@import {TSESTree as ESTree} from '@typescript-eslint/types';
@import * as ESLint from 'eslint';
*/

const MESSAGE_ID_ERROR = 'no-parent-test-context/error';
const MESSAGE_ID_SUGGESTION = 'no-parent-test-context/suggestion';
const messages = {
	[MESSAGE_ID_ERROR]: 'Do not use the parent test context `{{parent}}` inside this subtest. Use this subtest\'s own context instead.',
	[MESSAGE_ID_SUGGESTION]: 'Replace `{{parent}}` with `{{child}}`.',
};

const TEST_MODULES = new Set(['node:test', 'test']);

function getCalleeRoot(node) {
	let current = node;

	while (current.type === 'MemberExpression') {
		current = current.object;
	}

	if (current.type === 'Identifier') {
		return current;
	}
}

function isNodeTestImport(variable) {
	return variable?.defs.some(definition =>
		definition.type === 'ImportBinding'
		&& TEST_MODULES.has(definition.parent.source.value));
}

function isInsideNode(node, container, sourceCode) {
	const [nodeStart, nodeEnd] = sourceCode.getRange(node);
	const [containerStart, containerEnd] = sourceCode.getRange(container);
	return nodeStart >= containerStart && nodeEnd <= containerEnd;
}

function getParameterVariable(parameter, sourceCode) {
	if (parameter?.type !== 'Identifier') {
		return;
	}

	return findVariable(sourceCode.getScope(parameter), parameter) ?? undefined;
}

function getResolvedReference(node, sourceCode) {
	return sourceCode
		.getScope(node)
		.references
		.find(reference => reference.identifier === node)
		?.resolved;
}

function getParentContextFrame(frames, variable) {
	for (let index = frames.length - 2; index >= 0; index -= 1) {
		const frame = frames[index];
		if (frame.contextVariable === variable) {
			return frame;
		}
	}
}

function getContextReceiverFrame(node, frames, sourceCode) {
	const receiver = getSubtestReceiver(node);
	if (!receiver) {
		return;
	}

	const variable = getResolvedReference(receiver, sourceCode);
	if (!variable) {
		return;
	}

	return frames.findLast(frame => frame.contextVariable === variable);
}

function isShorthandPropertyValue(node) {
	return node.parent.type === 'Property' && node.parent.shorthand;
}

function canSuggestContextReplacement(node, currentFrame, sourceCode) {
	if (
		!currentFrame.contextParameter
		|| !isInsideNode(node, currentFrame.callback.body, sourceCode)
		|| isShorthandPropertyValue(node)
	) {
		return false;
	}

	return findVariable(sourceCode.getScope(node), currentFrame.contextParameter.name) === currentFrame.contextVariable;
}

function getParentContextProblem(node, frames, sourceCode) {
	const currentFrame = frames.at(-1);
	if (
		!currentFrame?.isSubtest
		|| !isInsideNode(node, currentFrame.callback, sourceCode)
	) {
		return;
	}

	const variable = getResolvedReference(node, sourceCode);
	if (!variable) {
		return;
	}

	const parentFrame = getParentContextFrame(frames, variable);
	if (!parentFrame) {
		return;
	}

	const data = {
		parent: parentFrame.contextParameter.name,
		child: currentFrame.contextParameter?.name,
	};

	const problem = {
		node,
		messageId: MESSAGE_ID_ERROR,
		data,
	};

	if (canSuggestContextReplacement(node, currentFrame, sourceCode)) {
		problem.suggest = [
			{
				messageId: MESSAGE_ID_SUGGESTION,
				data,
				fix: fixer => fixer.replaceText(node, currentFrame.contextParameter.name),
			},
		];
	}

	return problem;
}

/** @param {ESLint.Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const frames = [];

	context.on('CallExpression', node => {
		const receiver = getSubtestReceiver(node);
		const receiverProblem = receiver && getParentContextProblem(receiver, frames, sourceCode);
		const isSubtest = getContextReceiverFrame(node, frames, sourceCode) !== undefined;
		const parsed = parseTestCall(node, imports);
		const root = getCalleeRoot(node.callee);
		const isTest = parsed?.kind === 'test' && root && isNodeTestImport(getResolvedReference(root, sourceCode));

		if (!isTest && !isSubtest) {
			return receiverProblem;
		}

		const callback = getTestCallback(node);
		if (!callback) {
			return receiverProblem;
		}

		const contextParameter = callback.params[0];
		const contextVariable = getParameterVariable(contextParameter, sourceCode);

		frames.push({
			node,
			callback,
			contextParameter: contextParameter?.type === 'Identifier' ? contextParameter : undefined,
			contextVariable,
			isSubtest,
		});

		return receiverProblem;
	});

	context.on('Identifier', node => getParentContextProblem(node, frames, sourceCode));

	context.onExit('CallExpression', node => {
		if (frames.at(-1)?.node === node) {
			frames.pop();
		}
	});
};

/** @type {ESLint.Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow references to parent test contexts inside subtests.',
			recommended: 'unopinionated',
		},
		hasSuggestions: true,
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
