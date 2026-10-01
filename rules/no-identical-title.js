import {
	resolveImports,
	getRegistrationKind,
	getTestTitle,
	getStaticString,
	getTestCallback,
	getHookCallback,
	isOutOfLineCallback,
} from './utils/node-test.js';
import {functionTypes} from './ast/index.js';

const MESSAGE_ID = 'no-identical-title/duplicate';

const messages = {
	[MESSAGE_ID]: 'Test title is already used by another test in the same scope.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	/*
	Stack of title sets, one per scope level.
	The bottom of the stack (index 0) is the module top-level.
	Each suite, test, or hook callback body pushes a new set on entry and pops it on exit: the tests
	registered inside one belong to that callback, not to the level that encloses it.
	*/
	const scopeStack = [new Set()];

	/*
	The callback function nodes that open a title scope, so the scope is pushed when the body is
	entered and popped when it is left.
	*/
	const scopeCallbackNodes = new WeakSet();

	// A subtest (`t.test(…)`) is a test with a title and its own scope for its children, exactly like an imported test, so the shared registration helper classifies both.
	context.on('CallExpression', node => {
		const kind = getRegistrationKind(node, imports, context);
		if (!kind) {
			return;
		}

		// A hook's subtests belong to that hook body, not to registrations beside it.
		const callback = kind === 'hook' ? getHookCallback(node) : getTestCallback(node);
		if (callback) {
			scopeCallbackNodes.add(callback);
		}

		if (kind === 'hook') {
			return;
		}

		const titleNode = getTestTitle(node, context);
		if (!titleNode) {
			return;
		}

		const titleValue = getStaticString(titleNode, context);
		// An empty title is not the name the runner uses: `node:test` falls back to the callback's function name, so two empty titles are usually two different names.
		if (titleValue === undefined || titleValue === '') {
			return;
		}

		const currentScope = scopeStack.at(-1);
		if (currentScope.has(titleValue)) {
			return {
				node: titleNode,
				messageId: MESSAGE_ID,
			};
		}

		currentScope.add(titleValue);
	});

	// Push/pop a scope around each registration callback body, including one the call names out of line (`test('a', body)`), which the traversal reaches wherever it is declared.

	const opensScope = node => scopeCallbackNodes.has(node) || isOutOfLineCallback(node, context, imports);

	context.on(functionTypes, node => {
		if (opensScope(node)) {
			scopeStack.push(new Set());
		}
	});

	context.onExit(functionTypes, node => {
		if (opensScope(node)) {
			scopeStack.pop();
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow identical test titles within the same scope.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
