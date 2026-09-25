import {
	createContextTracker,
	getStaticString,
	isGetTestContextCall,
	isGlobalMock,
	resolveImports,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-mock-module-after-import';

const messages = {
	[MESSAGE_ID]: '`mock.module()` cannot affect `{{specifier}}` because it was already imported statically.',
};

/** Whether a re-export loads its target, which a type-only one does not, at either level. */
function isRuntimeExport(node) {
	if (node.exportKind === 'type') {
		return false;
	}

	// `export * from '…'` has no specifiers, and it loads its target.
	const {specifiers = []} = node;
	return specifiers.length === 0 || specifiers.some(specifier => specifier.exportKind !== 'type');
}

function isRuntimeImport(node) {
	if (node.importKind === 'type') {
		return false;
	}

	return node.specifiers.length === 0 || node.specifiers.some(specifier => specifier.importKind !== 'type');
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// `mock.module('os')` and `mock.module('node:os')` resolve to the same module, and so do
	// `import 'os'` and `import 'node:os'`, so the prefix is stripped before comparing.
	const normalizeSpecifier = specifier => specifier.replace(/^node:/, '');

	const staticImports = new Set();
	for (const node of sourceCode.ast.body) {
		// A static re-export loads the target just as an import does, and its bindings are just as
		// unmockable: `export {x} from 'os'`, `export * from 'os'`, `export * as os from 'os'`.
		const isStaticLoad = node.type === 'ImportDeclaration'
			? isRuntimeImport(node)
			: (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && isRuntimeExport(node);

		if (isStaticLoad && typeof node.source?.value === 'string') {
			staticImports.add(normalizeSpecifier(node.source.value));
		}
	}

	if (staticImports.size === 0) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	const isContextMock = node => {
		const mock = unwrapTypeScriptExpression(node);
		if (
			mock?.type !== 'MemberExpression'
			|| mock.computed
			|| mock.property.type !== 'Identifier'
			|| mock.property.name !== 'mock'
		) {
			return false;
		}

		const context = unwrapTypeScriptExpression(mock.object);
		return tracker.isContextIdentifier(context) || isGetTestContextCall(context, imports);
	};

	context.on('CallExpression', node => {
		tracker.update(node);
	});
	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});

	context.on('CallExpression', node => {
		const callee = unwrapTypeScriptExpression(node.callee);
		if (
			callee?.type !== 'MemberExpression'
			|| callee.computed
			|| callee.property.type !== 'Identifier'
			|| callee.property.name !== 'module'
			|| (!isGlobalMock(unwrapTypeScriptExpression(callee.object), imports) && !isContextMock(callee.object))
		) {
			return;
		}

		const specifier = getStaticString(node.arguments[0], context);
		if (specifier === undefined || !staticImports.has(normalizeSpecifier(specifier))) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
			data: {specifier},
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow mocking a module after statically importing it.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
