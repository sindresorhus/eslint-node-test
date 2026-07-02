import {resolveImports, createContextTracker} from './utils/node-test.js';

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

/**
Classify a call as an imported `node:assert` assertion (not the `t.assert.*` form, which is
already preferred) and resolve the method name to use on `t.assert`, accounting for strict mode.

@returns {{method: string} | undefined}
*/
const getAssertMethod = (node, imports) => {
	const {callee} = node;

	// `strictEqual(…)` — named import.
	if (callee.type === 'Identifier' && imports.assertNamed.has(callee.name)) {
		const method = imports.assertNamed.get(callee.name);
		const isStrict = imports.strictAssertLocals.has(callee.name);
		return {method: (isStrict && LOOSE_TO_STRICT.get(method)) || method};
	}

	// `assert(…)` — the bare assert function (alias of `ok`).
	if (callee.type === 'Identifier' && imports.assertNamespace.has(callee.name)) {
		return {method: 'ok'};
	}

	// `assert.strictEqual(…)` — namespace member.
	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.property.type === 'Identifier'
		&& callee.object.type === 'Identifier'
		&& imports.assertNamespace.has(callee.object.name)
	) {
		const method = callee.property.name;
		const isStrict = imports.strictAssertLocals.has(callee.object.name);
		return {method: (isStrict && LOOSE_TO_STRICT.get(method)) || method};
	}

	return undefined;
};

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

		const assertion = getAssertMethod(node, imports);
		if (!assertion) {
			return;
		}

		const {method} = assertion;
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
