import path from 'node:path';
import {getStaticStringValue} from './ast/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-import-test-files';
const IS_CASE_INSENSITIVE_FILE_SYSTEM = process.platform === 'darwin' || process.platform === 'win32';
const TEST_FILE_EXTENSIONS = new Set(['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx']);

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

function getSpecifierPath(specifier) {
	specifier = specifier.split(/[#?]/, 1)[0];
	if (
		(
			!specifier.startsWith('./')
			&& !specifier.startsWith('../')
		)
		|| /%2f|%5c/i.test(specifier)
	) {
		return;
	}

	specifier = specifier.replaceAll('\\', '/');

	try {
		return path.posix.normalize(decodeURIComponent(specifier));
	} catch {}
}

function getFilePath(specifier, filename, cwd) {
	const filePath = getSpecifierPath(specifier);
	if (!filePath) {
		return;
	}

	if (!filename || filename === '<input>' || filename === '<text>') {
		return filePath;
	}

	const resolvedFilePath = path.resolve(path.dirname(path.resolve(cwd, filename)), filePath);
	const relativeFilePath = path.relative(cwd, resolvedFilePath);
	if (
		relativeFilePath === '..'
		|| relativeFilePath.startsWith(`..${path.sep}`)
		|| path.isAbsolute(relativeFilePath)
	) {
		return;
	}

	return relativeFilePath.replaceAll(path.sep, '/');
}

function getCaseInsensitiveValue(value) {
	return IS_CASE_INSENSITIVE_FILE_SYSTEM ? value.toLowerCase() : value;
}

function isTestFileSpecifier(specifier, filename, cwd) {
	const filePath = getFilePath(specifier, filename, cwd);
	if (!filePath) {
		return false;
	}

	const pathSegments = filePath.split('/');
	if (pathSegments.includes('node_modules')) {
		return false;
	}

	for (const segment of pathSegments) {
		if (segment !== '..' && segment.startsWith('.')) {
			return false;
		}
	}

	const extension = path.posix.extname(filePath).slice(1);
	if (!TEST_FILE_EXTENSIONS.has(getCaseInsensitiveValue(extension))) {
		return false;
	}

	const name = path.posix.basename(filePath, `.${extension}`);
	const caseInsensitiveName = getCaseInsensitiveValue(name);
	return (
		pathSegments.includes('test')
		|| name === 'test'
		|| caseInsensitiveName.startsWith('test-')
		|| caseInsensitiveName.endsWith('.test')
		|| caseInsensitiveName.endsWith('_test')
		|| caseInsensitiveName.endsWith('-test')
	);
}

function getSpecifierValue(node) {
	return getStaticStringValue(unwrapTypeScriptExpression(node));
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const filename = context.physicalFilename ?? context.filename;
	const getProblem = (node, source) => {
		const specifier = getSpecifierValue(source);
		if (!specifier || !isTestFileSpecifier(specifier, filename, context.cwd)) {
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
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
