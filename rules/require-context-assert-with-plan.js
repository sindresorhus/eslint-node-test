import {
	resolveImports,
	parseTestCall,
	parseAssertionCall,
	createContextTracker,
} from './utils/node-test.js';

const MESSAGE_ID = 'require-context-assert-with-plan';

const messages = {
	[MESSAGE_ID]: 'This assertion is not counted by `{{context}}.plan()`. Use `{{context}}.assert` so the runner counts it toward the plan.',
};

/** Get the context name of a `<context>.plan(…)` call, or `undefined`. */
function getPlanContextName(node) {
	const {callee} = node;
	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.property.type === 'Identifier'
		&& callee.property.name === 'plan'
		&& callee.object.type === 'Identifier'
	) {
		return callee.object.name;
	}

	return undefined;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	// Without a `node:assert` import the only assertions are `t.assert.*` (which count toward the
	// plan and are excluded below), so there is nothing to report.
	if (!imports.isTestFile || !imports.hasAssert) {
		return;
	}

	const tracker = createContextTracker(imports);

	// One frame per enclosing test/subtest. Assertions attach to the innermost; the frame is
	// reported only if its test called `plan()`.
	const frames = [];

	context.on('CallExpression', node => {
		const isTest = parseTestCall(node, imports)?.kind === 'test' || tracker.isSubtestCall(node);
		tracker.update(node);

		if (isTest) {
			frames.push({
				node, contextName: tracker.current(), hasPlan: false, assertions: [],
			});
			return;
		}

		if (frames.length === 0) {
			return;
		}

		const planContextName = getPlanContextName(node);
		if (planContextName !== undefined) {
			// Mark the innermost frame whose test owns this context.
			for (let index = frames.length - 1; index >= 0; index -= 1) {
				if (frames[index].contextName === planContextName) {
					frames[index].hasPlan = true;
					break;
				}
			}

			return;
		}

		// Report only imported `node:assert` calls: `parseAssertionCall` leaves `contextReceiver`
		// unset for those, and sets it for every `<receiver>.assert.*` form (unwrapping TypeScript).
		// A `t.assert.*` call counts toward the plan, and a `.assert.*` call on an unrelated object
		// is not a `node:assert` assertion — neither should be reported.
		const parsed = parseAssertionCall(node, imports);
		if (parsed && !parsed.contextReceiver) {
			frames.at(-1).assertions.push(node);
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);

		if (frames.at(-1)?.node !== node) {
			return;
		}

		const frame = frames.pop();
		if (!frame.hasPlan || frame.contextName === undefined) {
			return;
		}

		return frame.assertions.map(assertion => ({
			node: assertion,
			messageId: MESSAGE_ID,
			data: {context: frame.contextName},
		}));
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Require assertions to use the test context when the test sets a plan.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
