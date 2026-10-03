import {
	createContextTracker,
	getCalleeChain,
	getHookCallback,
	getTestCallback,
	hasOnlyKnownModifiers,
	parseTestCall,
	resolveImports,
	TEST_FUNCTIONS,
} from './utils/node-test.js';
import {isImportBinding} from './utils/index.js';

const MESSAGE_ID = 'no-test-global-configuration';

const messages = {
	[MESSAGE_ID]: 'Do not configure `node:test` inside a test. This changes process-wide state.',
};

const configurationMethods = new Map([
	['assert', new Set(['register'])],
	['snapshot', new Set(['setDefaultSnapshotSerializers', 'setResolveSnapshotPath'])],
]);

function isNodeTestObjectReference(node, imports, sourceCode) {
	if (!isImportBinding(node, {sourceCode})) {
		return false;
	}

	return imports.namespaces.has(node.name) || TEST_FUNCTIONS.has(imports.locals.get(node.name));
}

function isConfigurationMethod(configuration, method) {
	return configurationMethods.get(configuration)?.has(method) ?? false;
}

function isGlobalConfigurationCall(node, imports, sourceCode) {
	const chain = getCalleeChain(node.callee);
	if (!chain) {
		return false;
	}

	const {root} = chain;
	const firstMember = chain.members[0];
	let {members} = chain;
	if (
		(
			imports.namespaces.has(root.name)
			&& !imports.locals.has(root.name)
			&& firstMember?.name === 'default'
		)
		|| (
			isNodeTestObjectReference(root, imports, sourceCode)
			&& TEST_FUNCTIONS.has(firstMember?.name)
		)
	) {
		members = chain.members.slice(1);
	}

	const configuration = imports.configurationLocals.get(root.name);
	if (
		configuration
		&& members.length === 1
		&& isImportBinding(root, {sourceCode})
	) {
		return isConfigurationMethod(configuration, members[0].name);
	}

	return (
		members.length === 2
		&& isNodeTestObjectReference(root, imports, sourceCode)
		&& isConfigurationMethod(members[0].name, members[1].name)
	);
}

function isTestCallbackCall(parsed) {
	return (
		parsed?.kind === 'test'
		&& hasOnlyKnownModifiers(parsed)
	);
}

function isSuiteCallbackCall(parsed) {
	return (
		parsed?.kind === 'suite'
		&& hasOnlyKnownModifiers(parsed)
	);
}

function isHookCall(parsed) {
	return parsed?.kind === 'hook'
		&& parsed.modifiers.length === 0;
}

function isInsideCallback(node, callbacks, boundaryCalls) {
	let current = node.parent;
	while (current) {
		if (callbacks.has(current)) {
			return true;
		}

		if (boundaryCalls?.has(current)) {
			return false;
		}

		current = current.parent;
	}

	return false;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const {sourceCode} = context;
	const configurationCallbacks = new Set();
	const suiteCallbacks = new Set();
	const testCalls = new Set();
	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (isSuiteCallbackCall(parsed)) {
			const callback = getTestCallback(node);
			if (callback) {
				suiteCallbacks.add(callback);
			}
		}

		if (isTestCallbackCall(parsed) || tracker.isSubtestCall(node)) {
			testCalls.add(node);

			const callback = getTestCallback(node);
			if (callback) {
				configurationCallbacks.add(callback);
			}
		} else if (isHookCall(parsed) && isInsideCallback(node, suiteCallbacks)) {
			const callback = getHookCallback(node);
			if (callback) {
				configurationCallbacks.add(callback);
			}
		}

		tracker.update(node);

		if (
			isInsideCallback(node, configurationCallbacks, testCalls)
			&& isGlobalConfigurationCall(node, imports, sourceCode)
		) {
			return {
				node,
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
			description: 'Disallow process-wide `node:test` configuration inside tests.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
