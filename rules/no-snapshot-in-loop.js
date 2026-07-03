import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	createContextTracker,
	MODIFIERS,
	parseTestCall,
	getSubtestReceiver,
	getCalleeChain,
} from './utils/node-test.js';
import {isLoop, isFunction} from './ast/index.js';

const MESSAGE_ID = 'no-snapshot-in-loop';

const messages = {
	[MESSAGE_ID]: 'Do not use positional snapshots inside loops. Changing the iteration count shifts every following snapshot.',
};

function isImportBinding(node, sourceCode) {
	const variable = findVariable(sourceCode.getScope(node), node);
	return variable?.defs.some(definition => definition.type === 'ImportBinding') ?? false;
}

function areModifiers(members) {
	return members.every(member => MODIFIERS.has(member.name));
}

function isInsideCurrentCallback(node, tracker) {
	const callback = tracker.currentCallback();
	if (!callback) {
		return false;
	}

	let current = node.parent;
	while (current) {
		if (current === callback) {
			return true;
		}

		current = current.parent;
	}

	return false;
}

function isCurrentContextReference(node, tracker, sourceCode) {
	const parameter = tracker.currentCallback()?.params[0];
	if (
		parameter?.type !== 'Identifier'
		|| node.name !== parameter.name
	) {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(node), node);
	return variable?.defs.some(definition => definition.name === parameter) ?? false;
}

function isTestRegistrationCall(node, imports, sourceCode) {
	const parsed = parseTestCall(node, imports);
	if (
		parsed?.kind !== 'test'
		|| !areModifiers(parsed.modifiers)
	) {
		return false;
	}

	const chain = getCalleeChain(node.callee);
	if (!chain) {
		return false;
	}

	return isImportBinding(chain.root, sourceCode);
}

function isSubtestRegistrationCall(node, tracker, sourceCode) {
	const receiver = getSubtestReceiver(node);
	return receiver !== undefined && isCurrentContextReference(receiver, tracker, sourceCode);
}

function shouldUpdateContext(node, imports, tracker, sourceCode) {
	return (
		isTestRegistrationCall(node, imports, sourceCode)
		|| isSubtestRegistrationCall(node, tracker, sourceCode)
	);
}

function isContextSnapshotCall(node, chain, tracker, sourceCode) {
	return (
		chain.members.length === 2
		&& chain.members[0].name === 'assert'
		&& chain.members[1].name === 'snapshot'
		&& isInsideCurrentCallback(node, tracker)
		&& isCurrentContextReference(chain.root, tracker, sourceCode)
	);
}

function isSnapshotCall(node, tracker, sourceCode) {
	const chain = getCalleeChain(node.callee);
	if (!chain) {
		return false;
	}

	return isContextSnapshotCall(node, chain, tracker, sourceCode);
}

function isInLoopBody(node) {
	let child = node;
	let current = node.parent;

	while (current) {
		if (isFunction(current)) {
			return false;
		}

		if (isLoop(current)) {
			return current.body === child;
		}

		child = current;
		current = current.parent;
	}

	return false;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		let problem;

		if (
			isSnapshotCall(node, tracker, sourceCode)
			&& isInLoopBody(node)
		) {
			problem = {
				node,
				messageId: MESSAGE_ID,
			};
		}

		if (shouldUpdateContext(node, imports, tracker, sourceCode)) {
			tracker.update(node);
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
		type: 'problem',
		docs: {
			description: 'Disallow snapshot assertions inside loop bodies.',
			recommended: false,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
