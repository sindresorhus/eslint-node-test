import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	createContextTracker,
	getFirstContextParameter,
	getOutOfLineCallbackCall,
	getRegistrationKind,
	isGetTestContextInScope,
	isUnreboundParameter,
} from './utils/node-test.js';
import {getEnclosingFunction, isUnshadowedGlobal, unwrapExpression} from './utils/index.js';

const MESSAGE_ID_ERROR = 'prefer-diagnostic/error';
const MESSAGE_ID_SUGGESTION = 'prefer-diagnostic/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: 'Prefer `{{context}}.diagnostic()` over `console.{{method}}()` inside a test, so the message is attached to the test as a TAP diagnostic.',
	[MESSAGE_ID_SUGGESTION]: 'Replace with `{{context}}.diagnostic()`.',
};

const CONSOLE_METHODS = new Set(['log', 'info', 'debug']);

/*
The `globalThis` / `global` identifier a node reaches `console` through, or `undefined` when it
is not that shape. Only the shape is checked here; the caller checks whether the receiver is the real
global, the way it does for a bare `console`. The receiver is unwrapped, so a cast or a non-null
assertion reads the same as the bare form.
*/
function getGlobalConsoleObject(node) {
	if (
		node?.type !== 'MemberExpression'
		|| node.computed
		|| node.property.type !== 'Identifier'
		|| node.property.name !== 'console'
	) {
		return;
	}

	const object = unwrapExpression(node.object);
	return object.type === 'Identifier' && (object.name === 'globalThis' || object.name === 'global')
		? object
		: undefined;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);
	// A test that declares no context parameter can still reach its context through
	// `getTestContext()`, so the file has to import that name.
	const {getTestContextName} = imports;

	// The `getTestContext` import is a binding like any other, so a local declaration in the test body shadows it.
	const getTestContextCall = node => getTestContextName && isGetTestContextInScope(imports, node) ? `${getTestContextName}()` : undefined;

	// A test body named out of line (`test('a', body)`) is entered where it is declared, which the call's own frame does not cover, so it is resolved from its binding instead. Like an inline body, it covers the functions declared in it.
	const getOutOfLineTestBody = node => {
		for (let current = getEnclosingFunction(node); current; current = getEnclosingFunction(current)) {
			if (getRegistrationKind(getOutOfLineCallbackCall(current, context, imports), imports, context) === 'test') {
				return current;
			}
		}
	};

	const isInside = (node, container) => {
		const [start, end] = context.sourceCode.getRange(container);
		const [nodeStart] = context.sourceCode.getRange(node);
		return nodeStart >= start && nodeStart < end;
	};

	/*
	The name to call `diagnostic()` on at `node`, or `undefined` when no test context is in scope there.

	The context parameter is only in scope inside the test callback, so there is nothing to rewrite outside one, including in the title/options arguments, which the traversal reaches before the callback, and in a suite callback, which the tracker does not track at all. A nested binding of the same name shadows the context, so `t.diagnostic(…)` there would not reach the test context at all.
	*/
	const getContextName = node => {
		const body = getOutOfLineTestBody(node);
		const callback = tracker.currentCallback();
		// The innermost test body names the context: an out-of-line subtest body declared inside a test callback has its own.
		if (
			callback
			&& isInside(node, callback)
			&& !(body && isInside(body, callback))
		) {
			const name = tracker.current();
			if (name) {
				return tracker.isContextNameInScope(name, node) ? name : undefined;
			}

			return getTestContextCall(node);
		}

		if (!body) {
			return;
		}

		const parameter = getFirstContextParameter(body.params);
		if (!parameter) {
			return getTestContextCall(node);
		}

		// A `var` of the same name in the body rebinds the parameter, so the name no longer reaches the test context.
		const variable = findVariable(context.sourceCode.getScope(node), parameter.name);
		return variable
			&& variable.identifiers.includes(parameter)
			&& isUnreboundParameter(variable)
			? parameter.name
			: undefined;
	};

	context.on('CallExpression', node => {
		tracker.update(node);

		const callee = unwrapExpression(node.callee);
		if (
			callee.type !== 'MemberExpression'
			|| callee.computed
			|| callee.property.type !== 'Identifier'
			|| !CONSOLE_METHODS.has(callee.property.name)
		) {
			return;
		}

		// A local `console` — a parameter, a declaration, a catch binding — is some other object, and
		// its `log` is not the global's. `globalThis.console` and `global.console` are the same object
		// as the bare global, the way `globalThis.process` is the same as `process`, so long as the
		// receiver is the real global.
		const object = unwrapExpression(callee.object);
		const globalObject = getGlobalConsoleObject(object);
		const isGlobalConsoleMember = globalObject !== undefined
			&& isUnshadowedGlobal(context, globalObject, globalObject.name);
		if (!isGlobalConsoleMember && !isUnshadowedGlobal(context, object, 'console')) {
			return;
		}

		const contextName = getContextName(node);
		if (!contextName) {
			return;
		}

		const method = callee.property.name;
		const data = {context: contextName, method};
		const problem = {
			node: callee,
			messageId: MESSAGE_ID_ERROR,
			data,
		};

		// `diagnostic()` takes a single message, so only suggest a rewrite for a single argument. A
		// spread counts as one argument but stands for any number of values, of which
		// `t.diagnostic(…args)` would print only the first.
		// Replacing the whole callee would also drop any comments inside it, such as
		// `console./* trace */log(…)`.
		if (
			node.arguments.length === 1
			&& node.arguments[0].type !== 'SpreadElement'
			&& context.sourceCode.getCommentsInside(callee).length === 0
		) {
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
