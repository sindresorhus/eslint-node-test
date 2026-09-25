import {findVariable, getStaticValue} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	parseAssertionCall,
	createContextTracker,
	getTestCallback,
	getContextParameterIdentifier,
	isGetTestContextCall,
	hasEnabledPlanOption,
	isEnabledPlanCount,
} from './utils/node-test.js';
import {isSkippedTestCall, isInsideSkippedCallback} from './shared/skipped-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'require-context-assert-with-plan';

const messages = {
	[MESSAGE_ID]: 'This assertion is not counted toward the test\'s plan. Use `{{context}}.assert` so the runner counts it.',
};

/** The variable a callback's context parameter binds, or `undefined` when it declares none. */
function getContextVariable(callback, sourceCode) {
	const parameter = getContextParameterIdentifier(callback?.params[0]);
	return parameter ? findVariable(sourceCode.getScope(parameter), parameter) : undefined;
}

/**
The receiver of a `<context>.plan(…)` call, `null` when the call is not a plan, and the string
`'getTestContext()'` when the receiver is a `getTestContext()` call rather than a context parameter.
*/
function getPlanReceiver(node, context, imports) {
	const callee = unwrapTypeScriptExpression(node.callee);
	if (
		callee?.type !== 'MemberExpression'
		|| callee.computed
		|| callee.property.type !== 'Identifier'
		|| callee.property.name !== 'plan'
	) {
		return null;
	}

	// A count that is statically known *not* to be a positive plan is excluded. `t.plan(0)` expects zero
	// counted assertions, so an imported `assert` is what keeps it passing and `t.assert` would fail it
	// (`plan expected 0 assertions but received 1`). `t.plan(-1)` throws before any assertion runs. A
	// count we cannot resolve is still a plan, so only a resolved non-count is excluded.
	const [countArgument] = node.arguments;
	if (countArgument) {
		const staticValue = getStaticValue(countArgument, context.sourceCode.getScope(countArgument));
		if (staticValue && !isEnabledPlanCount(staticValue)) {
			return null;
		}
	}

	const receiver = unwrapTypeScriptExpression(callee.object);
	return isGetTestContextCall(receiver, imports) ? 'getTestContext()' : receiver;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
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
	// The callbacks of statically skipped tests, subtests, and suites, which never run.
	const skippedCallbacks = new WeakSet();

	// A skipped test, subtest, or suite never runs its callback, so neither its plan nor its
	// assertions exist. Returns the callback when the call was skipped.
	const markSkipped = (node, parsed, isSubtest) => {
		if (!(parsed || isSubtest) || !isSkippedTestCall(node, parsed, context)) {
			return false;
		}

		const callback = getTestCallback(node);
		if (callback) {
			skippedCallbacks.add(callback);
		}

		return true;
	};

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		const isSubtest = tracker.isSubtestCall(node);
		const isTest = parsed?.kind === 'test' || isSubtest;
		tracker.update(node);

		if (markSkipped(node, parsed, isSubtest)) {
			return;
		}

		if (isTest) {
			const contextVariable = getContextVariable(getTestCallback(node), sourceCode);
			// `t.plan(1)` and the test-level `plan` option set the same expected count, so the
			// option counts here too.
			const hasPlanOption = hasEnabledPlanOption(node, context);
			const contextName = tracker.current();
			frames.push({
				node,
				contextName,
				// A test that declares no context parameter still has one, reachable through
				// `getTestContext()`, so the frame stands in as its own key.
				contextKey: contextVariable ?? undefined,
				hasPlan: hasPlanOption,
				// The message names the context to convert to, so it needs a declared parameter. A
				// test with none has nothing to suggest.
				planName: hasPlanOption && contextName ? contextName : undefined,
				assertions: [],
			});
			return;
		}

		if (frames.length === 0) {
			return;
		}

		if (isInsideSkippedCallback(node, skippedCallbacks)) {
			return;
		}

		const planReceiver = getPlanReceiver(node, context, imports);
		if (planReceiver !== null) {
			// Mark the innermost frame whose test owns this context. A `getTestContext()` call names
			// the innermost one.
			const receiverVariable = planReceiver === 'getTestContext()'
				? frames.at(-1)?.contextKey
				: findVariable(sourceCode.getScope(planReceiver), planReceiver);
			for (let index = frames.length - 1; index >= 0; index -= 1) {
				if (frames[index].contextKey === receiverVariable) {
					frames[index].hasPlan = true;
					// A plan set through `getTestContext()` names the context that way, since the
					// test may declare no parameter to name it after.
					frames[index].planName = planReceiver === 'getTestContext()' ? 'getTestContext()' : frames[index].contextName;
					break;
				}
			}

			return;
		}

		// Report only imported `node:assert` calls: `parseAssertionCall` leaves `contextReceiver`
		// unset for those, and sets it for every `<receiver>.assert.*` form (unwrapping TypeScript).
		// A `t.assert.*` call counts toward the plan, and a `.assert.*` call on an unrelated object
		// is not a `node:assert` assertion — neither should be reported.
		const assertion = parseAssertionCall(node, imports);
		if (assertion && !assertion.contextReceiver) {
			frames.at(-1).assertions.push(node);
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);

		if (frames.at(-1)?.node !== node) {
			return;
		}

		const frame = frames.pop();
		if (!frame.hasPlan || frame.planName === undefined) {
			return;
		}

		return frame.assertions.map(assertion => ({
			node: assertion,
			messageId: MESSAGE_ID,
			data: {context: frame.planName},
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
