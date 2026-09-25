import {
	resolveImports,
	parseTestCall,
	parseSupportedAssertionCall,
	getOutOfLineCallbackCall,
	getRegistrationKind,
	createContextTracker,
} from './utils/node-test.js';
import {functionTypes} from './ast/index.js';

const MESSAGE_ID = 'max-assertions';

const messages = {
	[MESSAGE_ID]: 'Too many assertions ({{count}}). Maximum allowed is {{max}}.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const {max} = context.options[0];
	const tracker = createContextTracker(imports);

	// One frame per enclosing test/subtest; assertions count toward the innermost.
	const frames = [];

	context.on('CallExpression', node => {
		const isTest = parseTestCall(node, imports)?.kind === 'test' || tracker.isSubtestCall(node);
		tracker.update(node);

		if (isTest) {
			frames.push({node, count: 0});
			return;
		}

		if (frames.length > 0 && parseSupportedAssertionCall(node, imports, tracker)) {
			frames.at(-1).count += 1;
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);

		if (frames.at(-1)?.node !== node) {
			return;
		}

		const {count} = frames.pop();
		if (count > max) {
			return {
				node,
				messageId: MESSAGE_ID,
				data: {count, max},
			};
		}
	});

	// A test body the call names out of line is entered where it is declared, which the call's own frame
	// does not cover, so the assertions in it would count toward nothing. The frame is keyed on the
	// function instead, and the report lands on it.
	const outOfLineFrames = new WeakSet();

	context.on(functionTypes, node => {
		const call = getOutOfLineCallbackCall(node, context, imports);
		if (getRegistrationKind(call, imports, tracker.isContextReceiver) !== 'test') {
			return;
		}

		outOfLineFrames.add(node);
		frames.push({node, count: 0});
	});

	context.onExit(functionTypes, node => {
		if (!outOfLineFrames.delete(node) || frames.at(-1)?.node !== node) {
			return;
		}

		const {count} = frames.pop();
		if (count > max) {
			return {
				node,
				messageId: MESSAGE_ID,
				data: {count, max},
			};
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Enforce a maximum number of assertions in a test.',
			recommended: false,
		},
		schema: [
			{
				type: 'object',
				properties: {
					max: {
						type: 'integer',
						minimum: 1,
						description: 'The maximum number of assertions allowed in a test.',
					},
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{max: 5}],
		messages,
		languages: ['js/js'],
	},
};

export default config;
