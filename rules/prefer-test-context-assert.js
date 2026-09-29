import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	createContextTracker,
	isGetTestContextInScope,
	parseAssertionCall,
	getOutOfLineCallbackCall,
	getRegistrationKind,
	getFirstContextParameter,
	LOOSE_TO_STRICT_METHODS,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import {functionTypes} from './ast/index.js';

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

	// The module is unwrapped too, so a cast or a non-null assertion on `assert` reads the same
	// as the bare form, the way `isAssertStrictMember` in the shared helper already does.
	const moduleObject = object?.type === 'MemberExpression' ? unwrapTypeScriptExpression(object.object) : undefined;
	return (
		moduleObject?.type === 'Identifier'
		&& !object.computed
		&& object.property.type === 'Identifier'
		&& object.property.name === 'strict'
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
	// `getTestContext()`, so the file has to import that name.
	const {getTestContextName} = imports;
	const getTestContextText = getTestContextName ? `${getTestContextName}()` : undefined;

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

	// The context of an inline test callback the tracker has open. A nested binding of the same name shadows the context, so `t.assert.ok(…)` (or `gtc().assert.ok(…)`) there would not reach the test context at all. The `getTestContext` import is a binding like any other, so a local declaration in the test body shadows it too.
	const getTrackedContextName = node => {
		if (tracker.current()) {
			return tracker.isContextNameInScope(tracker.current(), node) ? tracker.current() : undefined;
		}

		return isGetTestContextInScope(imports, node) ? getTestContextText : undefined;
	};

	// The context of a test body named out of line: its own context parameter while the name still reaches it at `node`, or else `getTestContext()`.
	const getOutOfLineContextName = (node, body) => {
		const parameter = getFirstContextParameter(body.params);
		if (!parameter) {
			return isGetTestContextInScope(imports, node) ? getTestContextText : undefined;
		}

		const variable = findVariable(sourceCode.getScope(node), parameter.name);
		const isContextParameter = variable?.defs.length === 1
			&& variable.defs[0].type === 'Parameter'
			&& variable.defs[0].node === body;
		return isContextParameter ? parameter.name : undefined;
	};

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
			&& isInsideCallback(node, callback, sourceCode)
			&& (body === undefined || isInsideCallback(callback, body, sourceCode));

		let contextName;
		if (isInTrackedCallback) {
			contextName = getTrackedContextName(node);
		} else if (body) {
			contextName = getOutOfLineContextName(node, body);
		}

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
