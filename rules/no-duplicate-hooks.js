import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	isContextHookCall,
	getContextHookName,
} from './utils/node-test.js';
import {getEnclosingFunction} from './utils/index.js';

const MESSAGE_ID = 'no-duplicate-hooks';

const messages = {
	[MESSAGE_ID]: 'Duplicate `{{name}}` hook in the same scope.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// The hook names already declared, keyed by the function the hook is written in (`undefined` for the module). A test, suite or hook body is its own function, and so is an out-of-line body (`describe('s', body)`), so each is its own scope. A hook inside another function, such as a helper (`function withDb() { beforeEach(…); }`), only counts against the other hooks in that same function, since which scope it registers in depends on where the function is called.
	const namesByFunction = new Map();

	// A hook declared on a context (`t.beforeEach(…)`) is a real hook, and it is not an imported binding, so the tracker is needed. A hook body's `t` is the context of the test the hook runs for, so a hook declared on it is registered on that test and fires there (a `beforeEach` for that test's subtests). It sits in the hook body's function, so it is not a duplicate of a hook outside it.
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		const isContextHook = isContextHookCall(node, tracker.isContextReceiver);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		const name = isContextHook ? getContextHookName(node) : (parsed?.kind === 'hook' ? parsed.name : undefined);
		if (name === undefined) {
			return;
		}

		const function_ = getEnclosingFunction(node);
		let names = namesByFunction.get(function_);
		if (!names) {
			names = new Set();
			namesByFunction.set(function_, names);
		}

		if (names.has(name)) {
			return {node, messageId: MESSAGE_ID, data: {name}};
		}

		names.add(name);
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
			description: 'Disallow duplicate hooks within the same scope.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
