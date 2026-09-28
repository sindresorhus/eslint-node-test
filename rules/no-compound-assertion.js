import {
	resolveImports,
	parseAssertionCall,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import {getParenthesizedRange} from './utils/index.js';

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

function buildFix({node, operands, sourceCode, context, hasPlan}) {
	return fixer => {
		if (
			// Splitting one assertion into several changes the assertion count, which a
			// `t.plan(n)` would then fail on.
			hasPlan
			|| node.arguments.length !== 1
			|| node.parent.type !== 'ExpressionStatement'
			// A static block is a plain statement list, so the split keeps the same shape. A braceless
			// control-flow parent is the case this cannot handle.
			|| !['Program', 'BlockStatement', 'StaticBlock'].includes(node.parent.parent.type)
			|| sourceCode.getCommentsInside(node.parent).length > 0
			|| !hasOnlyWhitespaceAfterStatement(sourceCode, node.parent)
		) {
			return undefined;
		}

		// The parenthesized range keeps the call's own parentheses, which a TypeScript wrapper around
		// the callee (`(assert.ok as any)`) needs: its text alone, `assert.ok as any`, does not parse
		// as a callee.
		const callee = sourceCode.text.slice(...getParenthesizedRange(node.callee, context));
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

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	// A plan counts only the assertions made through a test context, and it can come from the test itself, an outer test, a hook or the `plan` option, so which plan an assertion counts toward is not something to work out here. A context assertion is therefore split only in a file that never mentions `plan`, which a comment or an unrelated name can do too. An imported `node:assert` call never counts toward a plan, so it is always safe to split.
	const hasPlanMention = /\bplan\b/.test(sourceCode.text);
	const isContextAssertion = node => {
		const importedAssertion = parseAssertionCall(node, imports);
		return importedAssertion === undefined || importedAssertion.contextReceiver !== undefined;
	};

	context.on('CallExpression', node => {
		tracker.update(node);

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
				context,
				hasPlan: hasPlanMention && isContextAssertion(node),
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
