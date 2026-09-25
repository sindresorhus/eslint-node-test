import {findVariable} from '@eslint-community/eslint-utils';
import {resolveImports, getImportSpecifierName} from './utils/node-test.js';
import {unwrapExpression, getGlobalProcessObject, isUnshadowedGlobal} from './utils/index.js';

const MESSAGE_ID_PROCESS_EXIT = 'processExit';
const MESSAGE_ID_PROCESS_EXIT_CODE = 'processExitCode';

const messages = {
	[MESSAGE_ID_PROCESS_EXIT]: 'Do not call `process.exit()` in a test file. Throw an error or use an assertion instead.',
	[MESSAGE_ID_PROCESS_EXIT_CODE]: 'Do not set `process.exitCode` in a test file. Throw an error or use an assertion instead.',
};

const PROCESS_MODULES = new Set(['node:process', 'process']);

/**
The variables a file binds to the `exit` export of `node:process`, which is the same function as
`process.exit`.
*/
const getExitImportBindings = sourceCode => {
	const bindings = new Set();

	for (const node of sourceCode.ast.body) {
		// A type-only declaration binds no value, and a default or namespace import is the whole module
		// rather than one export, which this rule treats as an alias.
		if (
			node.type !== 'ImportDeclaration'
			|| node.importKind === 'type'
			|| !PROCESS_MODULES.has(node.source.value)
		) {
			continue;
		}

		for (const specifier of node.specifiers) {
			if (
				specifier.type === 'ImportSpecifier'
				&& specifier.importKind !== 'type'
				&& getImportSpecifierName(specifier) === 'exit'
			) {
				bindings.add(...sourceCode.getDeclaredVariables(specifier));
			}
		}
	}

	return bindings;
};

const getProcessProperty = (context, node, propertyName) => {
	const unwrapped = unwrapExpression(node);
	if (
		unwrapped?.type !== 'MemberExpression'
		|| unwrapped.computed
		|| unwrapped.property.type !== 'Identifier'
		|| unwrapped.property.name !== propertyName
	) {
		return;
	}

	const object = unwrapExpression(unwrapped.object);
	if (object?.type === 'Identifier' && object.name === 'process') {
		return unwrapped;
	}

	// A local `globalThis` or `global` is some other object, exactly as a local `process` is.
	const globalObject = getGlobalProcessObject(object);
	return globalObject && isUnshadowedGlobal(context, globalObject, globalObject.name) ? unwrapped : undefined;
};

/** Whether a call is a bare call to a name the file imported as `process.exit`. */
const getImportedExitCallee = (callee, exitBindings, sourceCode) => {
	const expression = unwrapExpression(callee);
	return expression?.type === 'Identifier' && exitBindings.has(findVariable(sourceCode.getScope(expression), expression))
		? expression
		: undefined;
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const exitBindings = getExitImportBindings(context.sourceCode);

	context.on('CallExpression', node => {
		const importedExit = getImportedExitCallee(node.callee, exitBindings, context.sourceCode);
		if (!getProcessProperty(context, node.callee, 'exit') && !importedExit) {
			return;
		}

		return {
			node: importedExit ?? node,
			messageId: MESSAGE_ID_PROCESS_EXIT,
		};
	});

	context.on('AssignmentExpression', node => {
		const exitCode = getProcessProperty(context, node.left, 'exitCode');
		if (!exitCode) {
			return;
		}

		return {
			node: exitCode,
			messageId: MESSAGE_ID_PROCESS_EXIT_CODE,
		};
	});

	context.on('UpdateExpression', node => {
		const exitCode = getProcessProperty(context, node.argument, 'exitCode');
		if (!exitCode) {
			return;
		}

		return {
			node: exitCode,
			messageId: MESSAGE_ID_PROCESS_EXIT_CODE,
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow process exit control in test files.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
