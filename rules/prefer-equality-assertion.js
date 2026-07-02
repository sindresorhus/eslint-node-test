import {resolveImports, parseAssertionCall} from './utils/node-test.js';
import {isParenthesized, getParenthesizedRange} from './utils/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'prefer-equality-assertion';

const messages = {
	[MESSAGE_ID]: 'Prefer `{{replacement}}` over `{{method}}` with a `{{operator}}` comparison for a clearer failure message.',
};

// Comparison operators and the assertion that preserves their semantics.
const OPERATOR_TO_METHOD = new Map([
	['===', 'strictEqual'],
	['!==', 'notStrictEqual'],
	['==', 'equal'],
	['!=', 'notEqual'],
]);

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		const parsed = parseAssertionCall(node, imports);
		// Only the truthiness assertions (`assert(…)` / `assert.ok(…)`) benefit.
		if (parsed?.method !== 'ok') {
			return;
		}

		const [rawArgument] = node.arguments;
		// Unwrap TypeScript casts (`(a === b) as boolean`) so the comparison is still recognized.
		const argument = rawArgument && unwrapTypeScriptExpression(rawArgument);
		if (argument?.type !== 'BinaryExpression') {
			return;
		}

		const replacement = OPERATOR_TO_METHOD.get(argument.operator);
		if (!replacement) {
			return;
		}

		const {callee} = node;
		const method = callee.type === 'MemberExpression' ? callee.property.name : 'ok';

		const problem = {
			node,
			messageId: MESSAGE_ID,
			data: {method, replacement, operator: argument.operator},
		};

		// Skip the autofix when it would be unsafe: extra parentheses or a comment inside
		// the comparison would be mangled by the rewrite, and a bare named import (`ok`)
		// cannot be rewritten to an unimported `strictEqual`.
		const isBareNamedImport = callee.type === 'Identifier' && !imports.assertNamespace.has(callee.name);
		if (
			isBareNamedImport
			|| isParenthesized(argument, context)
			|| sourceCode.getCommentsInside(argument).length > 0
		) {
			return problem;
		}

		problem.fix = function * (fixer) {
			// `assert.ok(…)` / `t.assert.ok(…)` rewrite just the method, while the bare
			// `assert(…)` namespace function becomes `assert.strictEqual(…)`.
			yield callee.type === 'MemberExpression'
				? fixer.replaceText(callee.property, replacement)
				: fixer.replaceText(callee, `${callee.name}.${replacement}`);

			// Split the comparison into two arguments: `left === right` -> `left, right`.
			// Use the parenthesized ranges so parenthesized operands stay intact.
			const leftEnd = getParenthesizedRange(argument.left, context)[1];
			const rightStart = getParenthesizedRange(argument.right, context)[0];
			yield fixer.replaceTextRange([leftEnd, rightStart], ', ');
		};

		return problem;
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Prefer an equality assertion over a truthiness assertion on a comparison.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
