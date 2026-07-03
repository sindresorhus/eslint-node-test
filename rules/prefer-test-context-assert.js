import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	createContextTracker,
	parseAssertionCall,
} from './utils/node-test.js';

const MESSAGE_ID_ERROR = 'prefer-test-context-assert/error';
const MESSAGE_ID_SUGGESTION = 'prefer-test-context-assert/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: 'Prefer the test context `{{context}}.assert.{{method}}()` over the imported `node:assert`, so the runner ties the assertion to this test.',
	[MESSAGE_ID_SUGGESTION]: 'Replace with `{{context}}.assert.{{method}}()`.',
};

// Under `node:assert/strict` these loose methods behave as their strict counterparts.
// `t.assert.*` exposes the non-strict functions, so preserve the behavior when converting.
const LOOSE_TO_STRICT = new Map([
	['equal', 'strictEqual'],
	['notEqual', 'notStrictEqual'],
	['deepEqual', 'deepStrictEqual'],
	['notDeepEqual', 'notDeepStrictEqual'],
]);

function isImportedAssertCallee(callee, imports) {
	if (
		callee.type === 'Identifier'
		&& (
			imports.assertNamed.has(callee.name)
			|| imports.assertNamespace.has(callee.name)
		)
	) {
		return true;
	}

	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.object.type === 'Identifier'
		&& (
			imports.assertNamespace.has(callee.object.name)
			|| imports.assertNamed.get(callee.object.name) === 'strict'
		)
	) {
		return true;
	}

	return (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.object.type === 'MemberExpression'
		&& !callee.object.computed
		&& callee.object.object.type === 'Identifier'
		&& callee.object.property.type === 'Identifier'
		&& callee.object.property.name === 'strict'
		&& imports.assertNamespace.has(callee.object.object.name)
	);
}

function getAssertMethod(node, imports) {
	const assertion = parseAssertionCall(node, imports);
	if (!assertion || !isImportedAssertCallee(node.callee, imports)) {
		return;
	}

	return (assertion.isStrict && LOOSE_TO_STRICT.get(assertion.method)) || assertion.method;
}

function isInsideCallback(node, callback, sourceCode) {
	const [callbackStart, callbackEnd] = sourceCode.getRange(callback);
	const [nodeStart] = sourceCode.getRange(node);

	return nodeStart >= callbackStart && nodeStart < callbackEnd;
}

function isContextParameterInScope(name, callback, node, sourceCode) {
	const parameter = callback.params[0];
	if (parameter?.type !== 'Identifier') {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(node), name);
	return variable?.defs.some(definition => definition.name === parameter) === true;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	// Needs both: an imported `node:assert` to convert from, and `node:test` to provide a context.
	if (!imports.hasAssert || !imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		tracker.update(node);

		const contextName = tracker.current();
		if (!contextName) {
			return;
		}

		const callback = tracker.currentCallback();
		if (
			!callback
			|| !isInsideCallback(node, callback, sourceCode)
			|| !isContextParameterInScope(contextName, callback, node, sourceCode)
		) {
			return;
		}

		const method = getAssertMethod(node, imports);
		if (!method) {
			return;
		}

		const data = {context: contextName, method};

		const problem = {
			node: node.callee,
			messageId: MESSAGE_ID_ERROR,
			data,
		};

		// Replacing the whole callee would drop any comments inside it.
		if (sourceCode.getCommentsInside(node.callee).length === 0) {
			problem.suggest = [
				{
					messageId: MESSAGE_ID_SUGGESTION,
					data,
					fix: fixer => fixer.replaceText(node.callee, `${contextName}.assert.${method}`),
				},
			];
		}

		return problem;
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Prefer the test context `t.assert` over the imported `node:assert`.',
			recommended: true,
		},
		hasSuggestions: true,
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
