import {findVariable} from '@eslint-community/eslint-utils';
import {resolveImports, createContextTracker} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import {getEnclosingFunction} from './utils/index.js';

const MESSAGE_ID = 'no-process-chdir-in-test';

const messages = {
	[MESSAGE_ID]: 'Do not call `process.chdir()` inside a test. Use absolute paths or a hook that restores the original directory.',
};

const PROCESS_MODULES = new Set(['node:process', 'process']);

const isValueImport = node => node.importKind === undefined || node.importKind === 'value';

const unwrapExpression = node => {
	let unwrapped = node && unwrapTypeScriptExpression(node);
	while (unwrapped?.type === 'ChainExpression') {
		unwrapped = unwrapTypeScriptExpression(unwrapped.expression);
	}

	return unwrapped;
};

const getImportSpecifierName = specifier => {
	if (specifier.imported.type === 'Identifier') {
		return specifier.imported.name;
	}

	return typeof specifier.imported.value === 'string' ? specifier.imported.value : undefined;
};

const addProcessImport = (specifier, sourceCode, processBindings, chdirBindings) => {
	if (!isValueImport(specifier)) {
		return;
	}

	const variable = findVariable(sourceCode.getScope(specifier.local), specifier.local);
	if (!variable) {
		return;
	}

	if (specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportNamespaceSpecifier') {
		processBindings.add(variable);
		return;
	}

	const importedName = getImportSpecifierName(specifier);
	if (importedName === 'default') {
		processBindings.add(variable);
	} else if (importedName === 'chdir') {
		chdirBindings.add(variable);
	}
};

const getProcessImports = sourceCode => {
	const processBindings = new Set();
	const chdirBindings = new Set();

	for (const node of sourceCode.ast.body) {
		if (
			node.type === 'ImportDeclaration'
			&& PROCESS_MODULES.has(node.source.value)
			&& isValueImport(node)
		) {
			for (const specifier of node.specifiers) {
				addProcessImport(specifier, sourceCode, processBindings, chdirBindings);
			}
		}
	}

	return {processBindings, chdirBindings};
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const {sourceCode} = context;
	const {processBindings, chdirBindings} = getProcessImports(sourceCode);
	const tracker = createContextTracker(imports);

	const isProcessReference = node => {
		node = unwrapExpression(node);
		if (node?.type !== 'Identifier') {
			return false;
		}

		const variable = findVariable(sourceCode.getScope(node), node);
		return processBindings.has(variable) || (node.name === 'process' && (!variable || variable.defs.length === 0));
	};

	const getChdirTarget = node => {
		const callee = unwrapExpression(node.callee);
		if (callee?.type === 'Identifier') {
			return chdirBindings.has(findVariable(sourceCode.getScope(callee), callee)) ? callee : undefined;
		}

		if (
			callee?.type === 'MemberExpression'
			&& !callee.computed
			&& callee.property.type === 'Identifier'
			&& callee.property.name === 'chdir'
			&& isProcessReference(callee.object)
		) {
			return callee;
		}
	};

	context.on('CallExpression', node => {
		const callback = tracker.currentCallback();
		const target = getChdirTarget(node);
		tracker.update(node);

		if (target && callback && getEnclosingFunction(node) === callback) {
			return {
				node: target,
				messageId: MESSAGE_ID,
			};
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow changing the working directory inside tests.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
