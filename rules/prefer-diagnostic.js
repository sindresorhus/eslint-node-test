import {resolveImports, createContextTracker} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID_ERROR = 'prefer-diagnostic/error';
const MESSAGE_ID_SUGGESTION = 'prefer-diagnostic/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: 'Prefer `{{context}}.diagnostic()` over `console.{{method}}()` inside a test, so the message is attached to the test as a TAP diagnostic.',
	[MESSAGE_ID_SUGGESTION]: 'Replace with `{{context}}.diagnostic()`.',
};

const CONSOLE_METHODS = new Set(['log', 'info', 'debug']);

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);
	// A test that declares no context parameter can still reach its context through
	// `getTestContext()`, so the file has to import that name under any local alias.
	const hasGetTestContextImport = imports.locals.values().toArray().includes('getTestContext');

	context.on('CallExpression', node => {
		tracker.update(node);

		const callee = unwrapTypeScriptExpression(node.callee);
		if (
			callee.type !== 'MemberExpression'
			|| callee.computed
			|| callee.property.type !== 'Identifier'
			|| !CONSOLE_METHODS.has(callee.property.name)
		) {
			return;
		}

		const object = unwrapTypeScriptExpression(callee.object);
		if (object?.type !== 'Identifier' || object.name !== 'console') {
			return;
		}

		// The context parameter is only in scope inside the test callback, so there is nothing to
		// rewrite outside one — including in the title/options arguments, which the traversal reaches
		// before the callback, and in a suite callback, which the tracker does not track at all.
		const callback = tracker.currentCallback();
		if (!callback) {
			return;
		}

		const contextName = tracker.current() ?? (hasGetTestContextImport ? 'getTestContext()' : undefined);
		if (!contextName) {
			return;
		}

		const [callStart, callEnd] = context.sourceCode.getRange(callback);
		const [consoleStart] = context.sourceCode.getRange(node);
		if (consoleStart < callStart || consoleStart >= callEnd) {
			return;
		}

		// A nested binding of the same name shadows the context, so `t.diagnostic(…)` there would
		// not reach the test context at all. `getTestContext()` is an import, so it cannot be shadowed.
		if (contextName !== 'getTestContext()' && !tracker.isContextNameInScope(contextName, node)) {
			return;
		}

		const method = callee.property.name;
		const data = {context: contextName, method};
		const problem = {
			node: callee,
			messageId: MESSAGE_ID_ERROR,
			data,
		};

		// `diagnostic()` takes a single message, so only suggest a rewrite for a single argument.
		// Replacing the whole callee would also drop any comments inside it, such as
		// `console./* trace */log(…)`.
		if (node.arguments.length === 1 && context.sourceCode.getCommentsInside(callee).length === 0) {
			problem.suggest = [
				{
					messageId: MESSAGE_ID_SUGGESTION,
					data,
					fix: fixer => fixer.replaceText(callee, `${contextName}.diagnostic`),
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
			description: 'Prefer the test context `diagnostic()` over `console` inside tests.',
			recommended: false,
		},
		hasSuggestions: true,
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
