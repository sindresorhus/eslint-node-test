import {findVariable, getStaticValue} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	parseAssertionCall,
	createContextTracker,
	getHookCallback,
	isContextHookCall,
	getTestCallback,
	getFirstContextParameter,
	getContextVariable,
	isGetTestContextCall,
	hasEnabledPlanOption,
	isEnabledPlanCount,
	getOutOfLineCallbackCall,
	getRegistrationKind,
	getPlanCallReceiver,
} from './utils/node-test.js';
import {functionTypes} from './ast/index.js';
import {isSkippedTestCall, isInsideSkippedCallback} from './shared/skipped-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'require-context-assert-with-plan';

const messages = {
	[MESSAGE_ID]: 'This assertion is not counted toward the test\'s plan. Use `{{context}}.assert` so the runner counts it.',
};

/**
The receiver of a `<context>.plan(…)` call, `null` when the call is not a plan, and the string
`'getTestContext()'` when the receiver is a `getTestContext()` call rather than a context parameter.
*/
function getPlanReceiver(node, context, imports) {
	const receiver = getPlanCallReceiver(node);
	if (receiver === undefined) {
		return null;
	}

	// A count that is statically known *not* to be a positive plan is excluded. `t.plan(0)` expects zero counted assertions, so an imported `assert` is what keeps it passing and `t.assert` would fail it (`plan expected 0 assertions but received 1`). `t.plan(-1)` throws before any assertion runs. A count we cannot resolve is still a plan, so only a resolved non-count is excluded.
	const [countArgument] = node.arguments;
	if (countArgument) {
		const staticValue = getStaticValue(countArgument, context.sourceCode.getScope(countArgument));
		if (staticValue && !isEnabledPlanCount(staticValue)) {
			return null;
		}
	}

	return isGetTestContextCall(receiver, imports) ? 'getTestContext()' : receiver;
}

/**
How the file can call `getTestContext()`: through its own import, or through the function every test binding carries (`test.getTestContext()`). `undefined` when no import reaches it.
*/
function getTestContextCallText(imports) {
	if (imports.getTestContextName) {
		return `${imports.getTestContextName}()`;
	}

	const binding = [...imports.namespaces][0]
		?? [...imports.locals].find(([, canonical]) => canonical === 'test' || canonical === 'it')?.[0];
	return binding ? `${binding}.getTestContext()` : undefined;
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

	// A hook's `t` is the context of the test the hook runs for, so a hook body opens a frame like a test body does. Node checks a plan set there only in some hooks (see `openFrame`).
	const tracker = createContextTracker(imports, {trackHooks: true});
	// A test with no context parameter can still reach its context through `getTestContext()`, so the message names that call, under whatever local name the file bound it to.
	const testContextCallText = getTestContextCallText(imports);

	// One frame per enclosing test, subtest, or hook. Assertions attach to the innermost; the frame is reported only if its test or hook called `plan()`, and Node checks that plan.
	const frames = [];
	// The callbacks of statically skipped tests, subtests, and suites, which never run.
	const skippedCallbacks = new WeakSet();

	// Open the frame for a test, subtest, or hook call, which is what its assertions and its plan attach to. `hookName` is the hook's name, or `undefined` for a test. `node` is what closes the frame: the call, or the callback itself when the call names it out of line.
	const openFrame = ({node, call, callback, hookName, isContextHook, contextName}) => {
		const isHook = hookName !== undefined;
		const contextVariable = getContextVariable(callback, context);
		// `t.plan(1)` and the test-level `plan` option set the same expected count, so the option counts here too. A hook has no `plan` option, so an object after its callback sets none.
		const hasPlanOption = !isHook && hasEnabledPlanOption(call, context);
		frames.push({
			node,
			contextName,
			// A test that declares no context parameter still has one, reachable through `getTestContext()`, so the frame stands in as its own key.
			contextKey: contextVariable ?? undefined,
			hasPlan: hasPlanOption,
			// Node checks a plan set in a hook only in a `beforeEach`, which runs as part of each test, and in a `before` on a test's own context, which plans that test. A plan set in any other hook is never checked, so an uncounted assertion there fails nothing.
			isPlanChecked: !isHook || hookName === 'beforeEach' || (hookName === 'before' && isContextHook),
			// The message names the context to convert to. A test with no declared parameter can only name a `getTestContext()` call.
			planName: hasPlanOption ? (contextName ?? testContextCallText) : undefined,
			assertions: [],
		});
	};

	const closeFrame = node => {
		if (frames.at(-1)?.node !== node) {
			return;
		}

		const frame = frames.pop();
		if (!frame.isPlanChecked || !frame.hasPlan || frame.planName === undefined) {
			return;
		}

		return frame.assertions.map(assertion => ({
			node: assertion,
			messageId: MESSAGE_ID,
			data: {context: frame.planName},
		}));
	};

	// A skipped test, subtest, or suite never runs its callback, so neither its plan nor its assertions exist. Returns the callback when the call was skipped.
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
		// A hook declared on the test's own context (`t.beforeEach(…)`) is a hook too, and its plan applies to the test's subtests the same way a top-level hook's does.
		const isContextHook = isContextHookCall(node, tracker.isContextReceiver);
		const hookName = parsed?.kind === 'hook'
			? parsed.name
			: (isContextHook ? unwrapTypeScriptExpression(node.callee).property.name : undefined);
		const isTest = parsed?.kind === 'test' || isSubtest || hookName !== undefined;
		tracker.update(node);

		if (markSkipped(node, parsed, isSubtest)) {
			return;
		}

		if (isTest) {
			openFrame({
				node,
				call: node,
				callback: hookName === undefined ? getTestCallback(node) : getHookCallback(node),
				hookName,
				isContextHook,
				contextName: tracker.current(),
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
			// Mark the innermost frame whose test owns this context. A `getTestContext()` call names the innermost one.
			const receiverVariable = planReceiver === 'getTestContext()'
				? frames.at(-1)?.contextKey
				: findVariable(sourceCode.getScope(planReceiver), planReceiver);
			for (let index = frames.length - 1; index >= 0; index -= 1) {
				if (frames[index].contextKey === receiverVariable) {
					frames[index].hasPlan = true;
					// A plan set through `getTestContext()` names the context that way, since the test may declare no parameter to name it after.
					frames[index].planName = planReceiver === 'getTestContext()'
						? testContextCallText
						: frames[index].contextName;
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
		return closeFrame(node);
	});

	// A test or hook body the call names out of line is entered where it is declared, outside the frame the call opens, so the frame is opened on the function instead. A local helper the test only calls is no registration, so its assertions stay with the test that calls it.
	context.on(functionTypes, node => {
		const call = getOutOfLineCallbackCall(node, context, imports);
		const kind = getRegistrationKind(call, imports, context);
		if (kind === undefined) {
			return;
		}

		const parsed = parseTestCall(call, imports);
		if (isSkippedTestCall(call, parsed, context)) {
			skippedCallbacks.add(node);
			return;
		}

		if (kind !== 'test' && kind !== 'hook') {
			return;
		}

		// A hook is imported (`beforeEach(body)`) or declared on a context (`t.beforeEach(body)`).
		const isContextHook = kind === 'hook' && parsed?.kind !== 'hook';
		const hookName = isContextHook ? unwrapTypeScriptExpression(call.callee).property.name : parsed?.name;
		openFrame({
			node,
			call,
			callback: node,
			hookName: kind === 'hook' ? hookName : undefined,
			isContextHook,
			contextName: getFirstContextParameter(node.params)?.name,
		});
	});

	context.onExit(functionTypes, closeFrame);
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
