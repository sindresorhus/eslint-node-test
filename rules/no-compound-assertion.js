import {
	resolveImports,
	parseTestCall,
	parseSupportedAssertionCall,
	createContextTracker,
	getTestCallback,
	hasEnabledPlanOption,
	isGetTestContextCall,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import {getStaticPropertyName} from './utils/index.js';

const MESSAGE_ID = 'no-compound-assertion';

const messages = {
	[MESSAGE_ID]: 'Split this compound assertion into separate assertions so the failing operand is clear.',
};

function getConjunctionOperands(node) {
	const unwrappedNode = unwrapTypeScriptExpression(node);

	if (unwrappedNode.type !== 'LogicalExpression' || unwrappedNode.operator !== '&&') {
		return [node];
	}

	return [
		...getConjunctionOperands(unwrappedNode.left),
		...getConjunctionOperands(unwrappedNode.right),
	];
}

function getIndent(sourceCode, node) {
	const prefix = sourceCode.lines[sourceCode.getLoc(node).start.line - 1].slice(0, sourceCode.getLoc(node).start.column);
	return /^\s*$/.test(prefix) ? prefix : undefined;
}

function hasOnlyWhitespaceAfterStatement(sourceCode, node) {
	const location = sourceCode.getLoc(node);
	const suffix = sourceCode.lines[location.end.line - 1].slice(location.end.column);
	return /^\s*$/.test(suffix);
}

function getOperandText(sourceCode, operand) {
	const text = sourceCode.getText(operand);
	return operand.type === 'SequenceExpression' ? `(${text})` : text;
}

function buildFix({node, operands, sourceCode, hasPlan}) {
	return fixer => {
		if (
			// Splitting one assertion into several changes the assertion count, which a
			// `t.plan(n)` would then fail on.
			hasPlan
			|| node.arguments.length !== 1
			|| node.parent.type !== 'ExpressionStatement'
			|| !['Program', 'BlockStatement'].includes(node.parent.parent.type)
			|| sourceCode.getCommentsInside(node.parent).length > 0
			|| !hasOnlyWhitespaceAfterStatement(sourceCode, node.parent)
		) {
			return undefined;
		}

		const callee = sourceCode.getText(node.callee);
		const indent = getIndent(sourceCode, node.parent);
		if (indent === undefined) {
			return undefined;
		}

		const replacement = operands
			.map(operand => `${callee}(${getOperandText(sourceCode, operand)});`)
			.join(`\n${indent}`);

		return fixer.replaceText(node.parent, replacement);
	};
}

/** Whether a call is `<context>.plan(…)` on a tracked test context, or a `getTestContext()` one. */
function isPlanCall(node, tracker, imports) {
	const callee = unwrapTypeScriptExpression(node.callee);
	if (callee?.type !== 'MemberExpression' || getStaticPropertyName(callee) !== 'plan') {
		return false;
	}

	const receiver = unwrapTypeScriptExpression(callee.object);
	return tracker.isContextIdentifier(receiver) || isGetTestContextCall(receiver, imports);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	// Callbacks whose body declared a `t.plan(n)`. Keyed on the callback node so a plan applies
	// to its own context only, and a nested context's plan cannot leak out when it exits.
	const plannedCallbacks = new Set();

	const hasPlan = () => tracker.currentCallback() !== undefined
		&& plannedCallbacks.has(tracker.currentCallback());

	context.on('CallExpression', node => {
		// A subtest is a method call, so it has to be recognized before the tracker pushes its context.
		const isSubtest = tracker.isSubtestCall(node);

		// The `plan` option sets the same expected count as `t.plan(n)`, so splitting one assertion into
		// several would break the plan the same way. It is read before the tracker learns this call,
		// because a test declared without a callback (`test('inner', {plan: 1})`) pushes no context of
		// its own, and the plan belongs to that test rather than to the one it sits inside.
		const planCallback = getTestCallback(node);
		if (
			(isSubtest || parseTestCall(node, imports)?.kind === 'test')
			&& planCallback
			&& hasEnabledPlanOption(node, context)
		) {
			plannedCallbacks.add(planCallback);
		}

		tracker.update(node);

		if (isPlanCall(node, tracker, imports)) {
			plannedCallbacks.add(tracker.currentCallback());
			return;
		}

		const assertion = parseSupportedAssertionCall(node, imports, tracker);
		if (assertion?.method !== 'ok') {
			return;
		}

		const [firstArgument] = node.arguments;
		if (!firstArgument || firstArgument.type === 'SpreadElement') {
			return;
		}

		const argument = unwrapTypeScriptExpression(firstArgument);
		if (argument.type !== 'LogicalExpression' || argument.operator !== '&&') {
			return;
		}

		const operands = getConjunctionOperands(argument);

		return {
			node,
			messageId: MESSAGE_ID,
			fix: buildFix({
				node,
				operands,
				sourceCode,
				hasPlan: hasPlan(),
			}),
		};
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow compound truthiness assertions.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
