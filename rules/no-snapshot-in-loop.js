import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	createContextTracker,
	getCalleeChain,
	getFirstContextParameter,
	getOutOfLineCallbackCall,
	getRegistrationKind,
	isGetTestContextCall,
} from './utils/node-test.js';
import {isLoop, isFunction, isMemberExpression} from './ast/index.js';
import {getEnclosingFunction, unwrapExpression} from './utils/index.js';

const MESSAGE_ID = 'no-snapshot-in-loop';

const messages = {
	[MESSAGE_ID]: 'Do not use positional snapshots inside loops. Changing the iteration count shifts every following snapshot.',
};

function isCurrentContextReference(node, callback, sourceCode) {
	const parameter = getFirstContextParameter(callback.params);
	if (
		!parameter
		|| node.name !== parameter.name
	) {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(node), node);
	return variable?.defs.some(definition => definition.name === parameter) ?? false;
}

// `getTestContext().assert.snapshot(…)` is the same call reached through a call rather than an identifier, so the callee chain cannot be walked down to a context parameter.
function isGetTestContextSnapshotCall(node, imports) {
	const callee = unwrapExpression(node.callee);
	if (!isMemberExpression(callee, 'snapshot')) {
		return false;
	}

	const assert = unwrapExpression(callee.object);
	return isMemberExpression(assert, 'assert')
		&& isGetTestContextCall(unwrapExpression(assert.object), imports);
}

/*
The test callback a snapshot call sits directly in: the tracked one, or a test body the call names out of line (`test('a', body)`), which is entered where it is declared, outside the call's frame, so it is resolved from its binding instead.
*/
function getEnclosingTestCallback(node, tracker, context, imports) {
	const callback = getEnclosingFunction(node);
	if (!callback) {
		return;
	}

	if (
		callback === tracker.currentCallback()
		|| getRegistrationKind(getOutOfLineCallbackCall(callback, context, imports), imports, context) === 'test'
	) {
		return callback;
	}
}

function isCurrentContextSnapshotCall(node, tracker, context, imports) {
	if (isGetTestContextSnapshotCall(node, imports)) {
		return getEnclosingTestCallback(node, tracker, context, imports) !== undefined;
	}

	const chain = getCalleeChain(node.callee);
	if (
		chain?.members.length !== 2
		|| chain.members[0].name !== 'assert'
		|| chain.members[1].name !== 'snapshot'
	) {
		return false;
	}

	const callback = getEnclosingTestCallback(node, tracker, context, imports);
	return callback !== undefined && isCurrentContextReference(chain.root, callback, context.sourceCode);
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
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		let problem;

		if (
			isCurrentContextSnapshotCall(node, tracker, context, imports)
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
