import {findVariable} from '@eslint-community/eslint-utils';
import {
	createContextTracker,
	getCalleeChain,
	getTestCallback,
	MODIFIERS,
	parseTestCall,
	resolveImports,
	TEST_FUNCTIONS,
} from './utils/node-test.js';

const MESSAGE_ID = 'no-test-global-configuration';

const messages = {
	[MESSAGE_ID]: 'Do not configure `node:test` inside a test. This changes process-wide state.',
};

const configurationMethods = new Map([
	['assert', new Set(['register'])],
	['snapshot', new Set(['setDefaultSnapshotSerializers', 'setResolveSnapshotPath'])],
]);

function isImportedReference(node, sourceCode) {
	const variable = findVariable(sourceCode.getScope(node), node);
	return variable?.defs.some(definition => definition.type === 'ImportBinding') ?? false;
}

function isNodeTestObjectReference(node, imports, sourceCode) {
	if (!isImportedReference(node, sourceCode)) {
		return false;
	}

	return node.name === imports.namespace || TEST_FUNCTIONS.has(imports.locals.get(node.name));
}

function isConfigurationMethod(configuration, method) {
	return configurationMethods.get(configuration)?.has(method) ?? false;
}

function isGlobalConfigurationCall(node, imports, sourceCode) {
	const chain = getCalleeChain(node.callee);
	if (!chain) {
		return false;
	}

	const {root, members} = chain;
	const configuration = imports.configurationLocals.get(root.name);
	if (
		configuration
		&& members.length === 1
		&& isImportedReference(root, sourceCode)
	) {
		return isConfigurationMethod(configuration, members[0].name);
	}

	return (
		members.length === 2
		&& isNodeTestObjectReference(root, imports, sourceCode)
		&& isConfigurationMethod(members[0].name, members[1].name)
	);
}

function isTestCallbackCall(node, imports) {
	const parsed = parseTestCall(node, imports);
	return (
		parsed?.kind === 'test'
		&& parsed.modifiers.every(modifier => MODIFIERS.has(modifier.name))
	);
}

function isInsideTestCallback(node, testCallbacks, testCalls) {
	let current = node.parent;
	while (current) {
		if (testCallbacks.has(current)) {
			return true;
		}

		if (testCalls.has(current)) {
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
	const testCallbacks = new Set();
	const testCalls = new Set();
	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		if (isTestCallbackCall(node, imports) || tracker.isSubtestCall(node)) {
			testCalls.add(node);

			const callback = getTestCallback(node);
			if (callback) {
				testCallbacks.add(callback);
			}
		}

		tracker.update(node);

		if (
			isInsideTestCallback(node, testCallbacks, testCalls)
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
