import {getStaticValue} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
	LOOSE_TO_STRICT_METHODS,
} from './utils/node-test.js';
import {unwrapExpression} from './utils/index.js';

const MESSAGE_ID = 'prefer-strict-assert';

const messages = {
	[MESSAGE_ID]: 'Prefer `{{replacement}}` over the legacy loose `{{method}}`.',
};

/** Whether a statically resolved value is a primitive, the only kind whose loose and strict comparisons are compared here. */
function isPrimitiveValue(value) {
	return value === null || (typeof value !== 'object' && typeof value !== 'function');
}

/**
Whether the strict replacement would reach a different verdict from the loose method for the operands
at `left` and `right`, which this can only tell when both resolve to a value.

`assert.equal` compares with `==` but treats two `NaN`s as equal, which is what `Object.is` does too, so
the two agree there. They differ on `±0`, on `null` against `undefined`, and on any pair the loose
comparison coerces between types, and each of those turns a passing assertion into a failing one. A pair
with a resolved object is treated as diverging without comparing it, since the loose methods coerce objects
and their nested values where the strict ones do not.

A pair that does not resolve is left to the runtime, which is where the difference shows up. That is the
same position `prefer-equality-assertion` takes, since it makes the same substitution.
*/
function operandsDiverge(left, right, context) {
	if (!left || !right) {
		return false;
	}

	// `getStaticValue` answers `null` for a value it cannot resolve, which is most of them, and a
	// `{value}` wrapper otherwise, so a resolved `undefined` is not mistaken for an unresolved one.
	const leftStatic = getStaticValue(unwrapExpression(left), context.sourceCode.getScope(left));
	const rightStatic = getStaticValue(unwrapExpression(right), context.sourceCode.getScope(right));
	if (leftStatic === null || rightStatic === null) {
		return false;
	}

	const leftValue = leftStatic.value;
	const rightValue = rightStatic.value;
	// A resolved object is not compared: `==` coerces it against a primitive (`equal([1], 1)` passes) and loose deep equality coerces the values nested in it (`deepEqual([1], ['1'])` passes), where the strict methods do neither.
	if (!isPrimitiveValue(leftValue) || !isPrimitiveValue(rightValue)) {
		return true;
	}

	const isEqualLoosely = leftValue === rightValue
		|| (Number.isNaN(leftValue) && Number.isNaN(rightValue))
		// eslint-disable-next-line eqeqeq
		|| leftValue == rightValue;
	return isEqualLoosely !== Object.is(leftValue, rightValue);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const assertion = parseSupportedAssertionCall(node, imports, tracker);
		// In a strict-mode assert module the legacy methods already behave strictly, so leave them.
		if (!assertion || assertion.isStrict) {
			return;
		}

		const replacement = LOOSE_TO_STRICT_METHODS.get(assertion.method);
		if (!replacement) {
			return;
		}

		const problem = {
			node,
			messageId: MESSAGE_ID,
			data: {method: assertion.method, replacement},
		};

		// Autofix only the member forms (`assert.equal`, `t.assert.equal`). A bare named
		// import (`equal`) cannot be rewritten to `strictEqual` without also importing it,
		// so leave it reported but unfixed. The callee is unwrapped first, so a cast around a
		// bare import is left unfixed too, exactly like the bare import it erases to.
		// The strict methods compare with `Object.is` where the loose ones use `==`, so an operand pair
		// the rewrite would flip is reported without a fix as well.
		const isBareNamedImport = assertion.methodNode === unwrapExpression(node.callee);
		if (
			assertion.methodNode
			&& !isBareNamedImport
			&& !operandsDiverge(node.arguments[0], node.arguments[1], context)
		) {
			problem.fix = fixer => fixer.replaceText(assertion.methodNode, replacement);
		}

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
			description: 'Prefer strict assertion methods over their legacy loose counterparts.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
