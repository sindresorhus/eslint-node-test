import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	createContextTracker,
	parseAssertionCall,
	LOOSE_TO_STRICT_METHODS,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID_ERROR = 'prefer-test-context-assert/error';
const MESSAGE_ID_SUGGESTION = 'prefer-test-context-assert/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: 'Prefer the test context `{{context}}.assert.{{method}}()` over the imported `node:assert`, so the runner ties the assertion to this test.',
	[MESSAGE_ID_SUGGESTION]: 'Replace with `{{context}}.assert.{{method}}()`.',
};

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

	if (callee.type !== 'MemberExpression' || callee.computed) {
		return false;
	}

	// The object may carry a TypeScript wrapper (`assert!.ok`, `(assert as any).ok`).
	const object = unwrapTypeScriptExpression(callee.object);
	if (
		object?.type === 'Identifier'
		&& (
			imports.assertNamespace.has(object.name)
			|| imports.assertNamed.get(object.name) === 'strict'
		)
	) {
		return true;
	}

	return (
		object?.type === 'MemberExpression'
		&& !object.computed
		&& object.object.type === 'Identifier'
		&& object.property.type === 'Identifier'
		&& object.property.name === 'strict'
		&& imports.assertNamespace.has(object.object.name)
	);
}

function getAssertMethod(node, imports) {
	const assertion = parseAssertionCall(node, imports);
	if (!assertion || !isImportedAssertCallee(unwrapTypeScriptExpression(node.callee), imports)) {
		return;
	}

	return (assertion.isStrict && LOOSE_TO_STRICT_METHODS.get(assertion.method)) || assertion.method;
}

function isInsideCallback(node, callback, sourceCode) {
	const [callbackStart, callbackEnd] = sourceCode.getRange(callback);
	const [nodeStart] = sourceCode.getRange(node);

	return nodeStart >= callbackStart && nodeStart < callbackEnd;
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
	// A test that declares no context parameter can still reach its context through
	// `getTestContext()`, so the file has to import that name. The suggestion has to spell the local
	// name the file actually bound, which is not `getTestContext` under an alias.
	const getTestContextName = [...imports.locals].find(([, canonicalName]) => canonicalName === 'getTestContext')?.[0];
	const isGetTestContextInScope = node => {
		if (!getTestContextName) {
			return false;
		}

		const variable = findVariable(sourceCode.getScope(node), getTestContextName);
		return variable?.defs.some(definition => definition.type === 'ImportBinding') ?? false;
	};

	context.on('CallExpression', node => {
		tracker.update(node);

		// Classify the call first: it is a cheap, memoized check, while the scope resolution below
		// walks the scope chain for every call it is given.
		const method = getAssertMethod(node, imports);
		if (!method) {
			return;
		}

		const contextName = tracker.current() ?? (getTestContextName ? `${getTestContextName}()` : undefined);
		if (!contextName) {
			return;
		}

		const callback = tracker.currentCallback();
		if (!callback || !isInsideCallback(node, callback, sourceCode)) {
			return;
		}

		// A nested binding of the same name shadows the context, so `t.assert.ok(…)` (or
		// `gtc().assert.ok(…)`) there would not reach the test context at all. The `getTestContext`
		// import is a binding like any other, so a local declaration in the test body shadows it too.
		if (tracker.current()) {
			if (!tracker.isContextNameInScope(contextName, node)) {
				return;
			}
		} else if (!isGetTestContextInScope(node)) {
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
