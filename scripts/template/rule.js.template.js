import {outdent} from 'outdent';
import indentString from 'indent-string';

const indent = (string, count) => indentString(string, count, {indent: '\t'});

const imports = outdent`
	import {resolveImports, parseTestCall} from './utils/node-test.js';
`;

const typeImports = outdent`
	/**
	@import {TSESTree as ESTree} from '@typescript-eslint/types';
	@import * as ESLint from 'eslint';
	*/
`;

const createMessages = data =>
	data.hasSuggestions
		? outdent`
			const MESSAGE_ID_ERROR = '${data.id}/error';
			const MESSAGE_ID_SUGGESTION = '${data.id}/suggestion';
			const messages = {
				[MESSAGE_ID_ERROR]: 'Describe the problem here.',
				[MESSAGE_ID_SUGGESTION]: 'Describe the suggested fix here.',
			};
		`
		: outdent`
			const MESSAGE_ID = '${data.id}';
			const messages = {
				[MESSAGE_ID]: 'Describe the problem here.',
			};
		`;

const fix = outdent`
	/** @param {ESLint.Rule.RuleFixer} fixer */
	fix: fixer => fixer.replaceText(node, 'replacement'),
`;

const suggestion = outdent`
	suggest: [
		{
			messageId: MESSAGE_ID_SUGGESTION,
	${indent(fix, 2)}
		},
	],
`;

const createRuleCreateFunction = data => outdent`
	/** @param {ESLint.Rule.RuleContext} context */
	const create = context => {
		const imports = resolveImports(context);
		if (imports.locals.size === 0 && !imports.namespace) {
			return;
		}

		context.on('CallExpression', node => {
			const parsed = parseTestCall(node, imports);
			if (!parsed) {
				return;
			}

			// TODO: Implement the rule logic.
			return {
				node,
				messageId: ${data.hasSuggestions ? 'MESSAGE_ID_ERROR' : 'MESSAGE_ID'},
	${data.fixableType ? indent(fix, 3) : ''}
	${data.hasSuggestions ? indent(suggestion, 3) : ''}
			};
		});
	};
`;

const createConfig = data => outdent`
	/** @type {ESLint.Rule.RuleModule} */
	const config = {
		create,
		meta: {
			type: '${data.type}',
			docs: {
				description: '${data.description}',
				recommended: 'unopinionated',
			},
			${data.fixableType ? `fixable: '${data.fixableType}',` : ''}
			${data.hasSuggestions ? 'hasSuggestions: true,' : ''}
			messages,
			languages: [
				'js/js',
			],
		},
	};
`;

export default function renderRuleTemplate(data) {
	return [
		imports,
		typeImports,
		createMessages,
		createRuleCreateFunction,
		createConfig,
		'export default config;',
	].map(part => typeof part === 'function' ? part(data) : part).join('\n\n')
	+ '\n';
}
