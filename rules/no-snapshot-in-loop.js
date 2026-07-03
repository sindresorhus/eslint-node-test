import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	createContextTracker,
	getCalleeChain,
} from './utils/node-test.js';
import {isLoop, isFunction} from './ast/index.js';

const MESSAGE_ID = 'no-snapshot-in-loop';

const messages = {
	[MESSAGE_ID]: 'Do not use positional snapshots inside loops. Changing the iteration count shifts every following snapshot.',
};

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

function isCurrentContextSnapshotCall(node, tracker, sourceCode) {
	const chain = getCalleeChain(node.callee);
	return (
		chain?.members.length === 2
		&& chain.members[0].name === 'assert'
		&& chain.members[1].name === 'snapshot'
		&& isInsideCurrentCallback(node, tracker)
		&& isCurrentContextReference(chain.root, tracker, sourceCode)
	);
}

function isInLoopBody(node) {
	let child = node;
	let current = node.parent;

	while (current) {
		if (isFunction(current)) {
			return false;
		}

		if (
			isLoop(current)
			&& current.body === child
		) {
			return true;
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
			isCurrentContextSnapshotCall(node, tracker, sourceCode)
			&& isInLoopBody(node)
		) {
			problem = {
				node,
				messageId: MESSAGE_ID,
			};
		}

		tracker.update(node);

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
