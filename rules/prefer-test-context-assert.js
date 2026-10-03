import {
	resolveImports,
	createContextTracker,
	getContextReceiverText,
	parseAssertionCall,
	getOutOfLineCallbackCall,
	getRegistrationKind,
	LOOSE_TO_STRICT_METHODS,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import {functionTypes, isMemberExpression} from './ast/index.js';
import {isNodeInside} from './utils/index.js';

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

	// The module is unwrapped too, so a cast or a non-null assertion on `assert` reads the same as the bare form, the way `isAssertStrictMember` in the shared helper already does.
	const moduleObject = object?.type === 'MemberExpression' ? unwrapTypeScriptExpression(object.object) : undefined;
	return (
		moduleObject?.type === 'Identifier'
		&& isMemberExpression(object, 'strict')
		&& imports.assertNamespace.has(moduleObject.name)
	);
}

function getAssertMethod(node, imports) {
	const assertion = parseAssertionCall(node, imports);
	if (!assertion || !isImportedAssertCallee(unwrapTypeScriptExpression(node.callee), imports)) {
		return;
	}

	return (assertion.isStrict && LOOSE_TO_STRICT_METHODS.get(assertion.method)) || assertion.method;
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

	// A test body the call names out of line (`test('a', body)`) is entered where it is declared, which the call's own frame does not cover, so it is tracked from the function.
	const outOfLineBodies = [];

	context.on(functionTypes, node => {
		const call = getOutOfLineCallbackCall(node, context, imports);
		if (getRegistrationKind(call, imports, context) === 'test') {
			outOfLineBodies.push(node);
		}
	});

	context.onExit(functionTypes, node => {
		if (outOfLineBodies.at(-1) === node) {
			outOfLineBodies.pop();
		}
	});

	context.on('CallExpression', node => {
		tracker.update(node);

		// Classify the call first: it is a cheap, memoized check, while the scope resolution below
		// walks the scope chain for every call it is given.
		const method = getAssertMethod(node, imports);
		if (!method) {
			return;
		}

		// The innermost test body wins: an inline callback the tracker has open, or a body named out of line, whichever sits inside the other.
		const callback = tracker.currentCallback();
		const body = outOfLineBodies.at(-1);
		const isInTrackedCallback = callback !== undefined
			&& isNodeInside(node, callback)
			&& (body === undefined || isNodeInside(callback, body));

		const testBody = isInTrackedCallback ? callback : body;
		const contextName = testBody && getContextReceiverText(testBody, node, imports, tracker.isContextReceiver);
		if (!contextName) {
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
