import {
	createContextTracker,
	getStaticString,
	isGlobalMock,
	resolveImports,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import {isMemberExpression} from './ast/index.js';

const MESSAGE_ID = 'no-mock-module-after-import';

const messages = {
	[MESSAGE_ID]: '`mock.module()` cannot affect `{{specifier}}` because it was already imported statically.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// `mock.module('os')` and `mock.module('node:os')` resolve to the same module, and so do `import 'os'` and `import 'node:os'`, so the prefix is stripped before comparing.
	const normalizeSpecifier = specifier => specifier.replace(/^node:/, '');

	const staticImports = new Set();
	for (const node of sourceCode.ast.body) {
		// Only an import that binds a value in this file, or a side-effect import, counts. An import whose every specifier is type-only (`import {type X} from '…'`) and a re-export (`export {x} from '…'`) bind nothing here, so a dynamic `import()` after the mock still gets the mocked module. A side-effect import binds nothing either, but it is only there for the side effects, which already ran with the real module and which the mock cannot undo.
		const isStaticLoad = node.type === 'ImportDeclaration'
			&& node.importKind !== 'type'
			&& (node.specifiers.length === 0 || node.specifiers.some(specifier => specifier.importKind !== 'type'));

		if (isStaticLoad && typeof node.source.value === 'string') {
			staticImports.add(normalizeSpecifier(node.source.value));
		}
	}

	if (staticImports.size === 0) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);
	});
	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});

	context.on('CallExpression', node => {
		const callee = unwrapTypeScriptExpression(node.callee);
		if (
			!isMemberExpression(callee, 'module')
			|| (!isGlobalMock(unwrapTypeScriptExpression(callee.object), imports) && !tracker.isContextMock(callee.object))
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
