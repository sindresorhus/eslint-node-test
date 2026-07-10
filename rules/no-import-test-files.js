import path from 'node:path';
import {getStaticStringValue} from './ast/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-import-test-files';

const messages = {
	[MESSAGE_ID]: 'Do not import a test file. The Node.js test runner may execute it twice.',
};

function isTypeOnlyImport(node) {
	return node.importKind === 'type'
		|| (
			node.specifiers.length > 0
			&& node.specifiers.every(specifier => specifier.importKind === 'type')
		);
}

function isTypeOnlyExport(node) {
	return node.exportKind === 'type'
		|| (
			node.specifiers.length > 0
			&& node.specifiers.every(specifier => specifier.exportKind === 'type')
		);
}

function isRelativeSpecifier(specifier) {
	return specifier.startsWith('./') || specifier.startsWith('../');
}

function isTestFileSpecifier(specifier, extensions) {
	if (!isRelativeSpecifier(specifier)) {
		return false;
	}

	const filePath = path.posix.normalize(specifier.replaceAll('\\', '/').split(/[#?]/, 1)[0]);
	const extension = path.posix.extname(filePath).slice(1);
	if (!extensions.includes(extension)) {
		return false;
	}

	const pathSegments = new Set(filePath.split('/'));
	if (pathSegments.has('node_modules')) {
		return false;
	}

	const name = path.posix.basename(filePath, `.${extension}`);
	return (
		pathSegments.has('test')
		|| name === 'test'
		|| name.startsWith('test-')
		|| name.endsWith('.test')
		|| name.endsWith('_test')
		|| name.endsWith('-test')
	);
}

function getSpecifierValue(node) {
	return getStaticStringValue(unwrapTypeScriptExpression(node));
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {extensions} = context.options[0];
	const getProblem = (node, source) => {
		const specifier = getSpecifierValue(source);
		if (!specifier || !isTestFileSpecifier(specifier, extensions)) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
		};
	};

	context.on('ImportDeclaration', node => {
		if (isTypeOnlyImport(node)) {
			return;
		}

		return getProblem(node, node.source);
	});
	context.on('ExportNamedDeclaration', node => {
		if (!node.source || isTypeOnlyExport(node)) {
			return;
		}

		return getProblem(node, node.source);
	});
	context.on('ExportAllDeclaration', node => {
		if (node.exportKind === 'type') {
			return;
		}

		return getProblem(node, node.source);
	});
	context.on('ImportExpression', node => getProblem(node, node.source));
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow imports of Node.js test files.',
			recommended: 'unopinionated',
		},
		schema: [
			{
				type: 'object',
				properties: {
					extensions: {
						type: 'array',
						items: {
							type: 'string',
						},
						minItems: 1,
						uniqueItems: true,
						description: 'File extensions that the Node.js test runner discovers.',
					},
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{extensions: ['js', 'mjs', 'cjs']}],
		messages,
		languages: ['js/js'],
	},
};

export default config;
