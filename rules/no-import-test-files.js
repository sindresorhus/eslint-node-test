import path from 'node:path';
import {getStaticStringValue} from './ast/index.js';
import {isUnshadowedGlobal, unwrapTypeScriptExpression} from './utils/index.js';

const MESSAGE_ID = 'no-import-test-files';
const IS_CASE_INSENSITIVE_FILE_SYSTEM = process.platform === 'darwin' || process.platform === 'win32';
const TEST_FILE_EXTENSIONS = new Set(['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx']);

const messages = {
	[MESSAGE_ID]: 'Do not import a test file. The Node.js test runner may execute it twice.',
};

function getSpecifierPath(specifier) {
	specifier = specifier.split(/[#?]/, 1)[0];
	// An encoded separator could point anywhere, so nothing is inferred from the path.
	if (/%2f|%5c/i.test(specifier)) {
		return;
	}

	// Windows accepts a backslash in a specifier, so normalize it before deciding whether the
	// specifier is relative at all.
	specifier = specifier.replaceAll('\\', '/');
	if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
		return;
	}

	try {
		return path.posix.normalize(decodeURIComponent(specifier));
	} catch {}
}

function getFilePath(specifier, filename, cwd) {
	const filePath = getSpecifierPath(specifier);
	if (!filePath) {
		return;
	}

	const baseDirectory = filename && filename !== '<input>' && filename !== '<text>'
		? path.dirname(path.resolve(cwd, filename))
		: cwd;
	const resolvedFilePath = path.resolve(baseDirectory, filePath);
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
		if (segment.startsWith('.')) {
			return false;
		}
	}

	const extension = path.posix.extname(filePath).slice(1);
	if (!TEST_FILE_EXTENSIONS.has(getCaseInsensitiveValue(extension))) {
		return false;
	}

	// Every name comparison goes through `getCaseInsensitiveValue`: on a case-insensitive file
	// system `./TEST/Example.Test.js` resolves to the same file as `./test/example.test.js`.
	const name = getCaseInsensitiveValue(path.posix.basename(filePath, `.${extension}`));
	return (
		pathSegments.some(segment => getCaseInsensitiveValue(segment) === 'test')
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

/**
Whether a declaration brings in nothing but types, which TypeScript erases entirely, so the module is
never loaded. Both the declaration-level `import type`/`export type` and the specifier-level
`import {type X}`/`export {type X}` qualify; a mixed declaration still loads the module.
*/
function isTypeOnly(node) {
	if (node.importKind === 'type' || node.exportKind === 'type') {
		return true;
	}

	// An export specifier carries `exportKind`, an import specifier `importKind`.
	const {specifiers = []} = node;
	return specifiers.length > 0
		&& specifiers.every(specifier => specifier.importKind === 'type' || specifier.exportKind === 'type');
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

	/*
	The `require(…)` specifier of a TypeScript import-equals or `export =` form. The import-equals form
	hides it on a `TSExternalModuleReference`; the `export =` form is the `require(…)` call itself.
	*/
	const getRequireProblem = (node, expression) => {
		const argument = expression?.type === 'TSExternalModuleReference'
			? expression.expression
			: (expression?.type === 'CallExpression'
				&& expression.callee.type === 'Identifier'
				&& expression.callee.name === 'require'
				&& isUnshadowedGlobal(context, expression.callee, 'require')
				? expression.arguments[0]
				: undefined);
		return argument ? getProblem(node, argument) : undefined;
	};

	context.on('ImportDeclaration', node => {
		if (isTypeOnly(node)) {
			return;
		}

		return getProblem(node, node.source);
	});
	context.on('ExportNamedDeclaration', node => {
		if (!node.source || isTypeOnly(node)) {
			return;
		}

		return getProblem(node, node.source);
	});
	context.on('ExportAllDeclaration', node => {
		if (isTypeOnly(node)) {
			return;
		}

		return getProblem(node, node.source);
	});
	context.on('ImportExpression', node => getProblem(node, node.source));
	// A CommonJS `require('./other.test.js')` loads the target the same way an import does, so the
	// runner really does execute the dependency a second time.
	context.on('CallExpression', node => getRequireProblem(node, node));
	// TypeScript's own import forms, where the specifier sits on an external module reference
	// instead of an `ImportDeclaration.source`.
	context.on('TSImportEqualsDeclaration', node => {
		if (node.importKind === 'type') {
			return;
		}

		return getRequireProblem(node, node.moduleReference);
	});
	context.on('TSExportAssignment', node => getRequireProblem(node, node.expression));
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
