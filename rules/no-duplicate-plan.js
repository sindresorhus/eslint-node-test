import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getSubtestReceiver,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-duplicate-plan';

const messages = {
	[MESSAGE_ID]: 'Do not call `{{context}}.plan()` more than once in the same test.',
};

function getPlanContextIdentifier(node) {
	const {callee} = node;
	if (
		node.optional !== true
		&& callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.optional !== true
		&& callee.property.type === 'Identifier'
		&& callee.property.name === 'plan'
	) {
		const object = unwrapTypeScriptExpression(callee.object);
		return object.type === 'Identifier' ? object : undefined;
	}

	return undefined;
}

function getCalleeRootIdentifier(node) {
	while (node.type === 'MemberExpression') {
		node = node.object;
	}

	return node.type === 'Identifier' ? node : undefined;
}

function getIdentifierVariable(sourceCode, identifier) {
	return findVariable(sourceCode.getScope(identifier), identifier);
}

function isImportedIdentifier(sourceCode, identifier) {
	return getIdentifierVariable(sourceCode, identifier)?.defs.some(({type}) => type === 'ImportBinding') ?? false;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const {sourceCode} = context;
	const frames = [];

	const isSubtestCall = node => {
		const receiver = getSubtestReceiver(node);
		if (receiver === undefined) {
			return false;
		}

		const receiverVariable = getIdentifierVariable(sourceCode, receiver);
		return receiverVariable !== undefined && frames.some(frame => frame.contextVariable === receiverVariable);
	};

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		const rootIdentifier = parsed?.kind === 'test' ? getCalleeRootIdentifier(node.callee) : undefined;
		const isTest = (
			(
				parsed?.kind === 'test'
				&& rootIdentifier !== undefined
				&& isImportedIdentifier(sourceCode, rootIdentifier)
			)
			|| isSubtestCall(node)
		);

		if (isTest) {
			const parameter = getTestCallback(node)?.params[0];
			if (parameter?.type !== 'Identifier') {
				return;
			}

			frames.push({
				node,
				contextName: parameter.name,
				contextVariable: getIdentifierVariable(sourceCode, parameter),
				hasPlan: false,
			});
			return;
		}

		const contextIdentifier = getPlanContextIdentifier(node);
		if (contextIdentifier === undefined) {
			return;
		}

		const contextVariable = getIdentifierVariable(sourceCode, contextIdentifier);
		if (contextVariable === undefined) {
			return;
		}

		for (let index = frames.length - 1; index >= 0; index -= 1) {
			const frame = frames[index];
			if (frame.contextVariable !== contextVariable) {
				continue;
			}

			if (frame.hasPlan) {
				return {
					node,
					messageId: MESSAGE_ID,
					data: {context: frame.contextName},
				};
			}

			frame.hasPlan = true;
			break;
		}
	});

	context.onExit('CallExpression', node => {
		if (frames.at(-1)?.node === node) {
			frames.pop();
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow calling `t.plan()` more than once in the same test.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
