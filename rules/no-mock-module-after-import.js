import {
	createContextTracker,
	getStaticString,
	isGlobalMock,
	resolveImports,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-mock-module-after-import';

const messages = {
	[MESSAGE_ID]: '`mock.module()` cannot affect `{{specifier}}` because it was already imported statically.',
};

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

	const staticImports = new Set();
	for (const node of sourceCode.ast.body) {
		if (
			node.type === 'ImportDeclaration'
			&& typeof node.source.value === 'string'
			&& isRuntimeImport(node)
		) {
			staticImports.add(node.source.value);
		}
	}

	if (staticImports.size === 0) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	const isContextMock = node => {
		node = unwrapTypeScriptExpression(node);
		return node?.type === 'MemberExpression'
			&& !node.computed
			&& node.property.type === 'Identifier'
			&& node.property.name === 'mock'
			&& tracker.isContextIdentifier(unwrapTypeScriptExpression(node.object));
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
		if (specifier === undefined || !staticImports.has(specifier)) {
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
