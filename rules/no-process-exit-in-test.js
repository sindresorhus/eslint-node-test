import {resolveImports} from './utils/node-test.js';
import {unwrapExpression} from './utils/index.js';

const MESSAGE_ID_PROCESS_EXIT = 'processExit';
const MESSAGE_ID_PROCESS_EXIT_CODE = 'processExitCode';

const messages = {
	[MESSAGE_ID_PROCESS_EXIT]: 'Do not call `process.exit()` in a test file. Throw an error or use an assertion instead.',
	[MESSAGE_ID_PROCESS_EXIT_CODE]: 'Do not set `process.exitCode` in a test file. Throw an error or use an assertion instead.',
};

const getProcessProperty = (node, propertyName) => {
	const unwrapped = unwrapExpression(node);
	if (
		unwrapped?.type !== 'MemberExpression'
		|| unwrapped.computed
		|| unwrapped.property.type !== 'Identifier'
		|| unwrapped.property.name !== propertyName
	) {
		return;
	}

	const object = unwrapExpression(unwrapped.object);
	if (object?.type === 'Identifier' && object.name === 'process') {
		return unwrapped;
	}
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		if (!getProcessProperty(node.callee, 'exit')) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID_PROCESS_EXIT,
		};
	});

	context.on('AssignmentExpression', node => {
		const exitCode = getProcessProperty(node.left, 'exitCode');
		if (!exitCode) {
			return;
		}

		return {
			node: exitCode,
			messageId: MESSAGE_ID_PROCESS_EXIT_CODE,
		};
	});

	context.on('UpdateExpression', node => {
		const exitCode = getProcessProperty(node.argument, 'exitCode');
		if (!exitCode) {
			return;
		}

		return {
			node: exitCode,
			messageId: MESSAGE_ID_PROCESS_EXIT_CODE,
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow process exit control in test files.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
