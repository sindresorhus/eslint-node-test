import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
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

const isStrictOperator = operator => operator === '===' || operator === '!==';

const isNumericLiteral = node => node?.type === 'Literal' && typeof node.value === 'number';

/*
Whether an operand is statically `NaN`-producing: the `NaN` identifier, a division of two number
literals (which can be `0 / 0`), a `Number`/`parseInt`/`parseFloat` call, or a negation of one. A
plain identifier or general call is left to the runtime, matching the rule's best-effort stance.
*/
function couldBeNaN(node) {
	node = unwrapTypeScriptExpression(node);
	if (node.type === 'Identifier') {
		return node.name === 'NaN';
	}

	if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
		return ['Number', 'parseInt', 'parseFloat'].includes(node.callee.name);
	}

	if (node.type === 'BinaryExpression' && node.operator === '/') {
		return isNumericLiteral(unwrapTypeScriptExpression(node.left))
			&& isNumericLiteral(unwrapTypeScriptExpression(node.right));
	}

	return node.type === 'UnaryExpression'
		&& (node.operator === '-' || node.operator === '+')
		&& couldBeNaN(node.argument);
}

/* Whether an operand is statically `0` or `-0`, a value on which `===` and `Object.is` differ. */
function isZeroOperand(node) {
	node = unwrapTypeScriptExpression(node);
	if (isNumericLiteral(node)) {
		return node.value === 0;
	}

	// A signed literal is only a zero when the literal is zero: `-1` is an ordinary number on which
	// `===` and `Object.is` agree, so it must not block the fix.
	if (node.type === 'UnaryExpression' && (node.operator === '-' || node.operator === '+')) {
		const argument = unwrapTypeScriptExpression(node.argument);
		return isNumericLiteral(argument) && argument.value === 0;
	}

	return false;
}

/*
`strictEqual`/`notStrictEqual` use `Object.is`, which differs from `===`/`!==` on `NaN` and `±0`, so
the fix is suppressed only when an operand is one of those values. `equal`/`notEqual` are `==`/`!=`
with `NaN` treated as equal to itself, so they differ when both operands are `NaN`. One visible `NaN` operand is enough to suppress the fix, since the other side may be `NaN` at runtime: `a == NaN` is always false, while `equal(a, NaN)` passes when `a` is `NaN`.
*/
function operandDivergesFromReplacement(operator, left, right) {
	if (couldBeNaN(left) || couldBeNaN(right)) {
		return true;
	}

	return isStrictOperator(operator) && (isZeroOperand(left) || isZeroOperand(right));
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const parsed = parseSupportedAssertionCall(node, imports, tracker);
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

		if (
			parsed.isStrict
			&& (
				argument.operator === '=='
				|| argument.operator === '!='
			)
		) {
			return;
		}

		const replacement = OPERATOR_TO_METHOD.get(argument.operator);
		if (!replacement) {
			return;
		}

		// A TypeScript wrapper on the callee (`assert!`, `(assert as any)`) is not part of the assert
		// call, so rewrite the callee inside it and leave the wrapper in place.
		const callee = unwrapTypeScriptExpression(node.callee);
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
			// The replacement is not always equivalent to the operator: `===`/`!==` are SameValue-zero
			// while `strictEqual`/`notStrictEqual` are `Object.is` (differ on `NaN` and `±0`), and
			// `equal`/`notEqual` treat `NaN` as equal to itself while `==`/`!=` do not. When an
			// operand would make the rewrite flip the assertion's outcome, it is only reported.
			|| operandDivergesFromReplacement(argument.operator, argument.left, argument.right)
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
