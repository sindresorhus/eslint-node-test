import skipExpressionWrappers, {outermostExpressionWrapper} from './skip-expression-wrappers.js';
import {hasLooserBindThanAwait} from './unwrap-typescript-expression.js';

/**
Whether `child` passes its value on to `parent`, so a statement that discards `parent`'s value
discards `child`'s too.

A conditional, logical, or sequence expression has one operand whose value the whole expression takes:
the test is not it for a conditional, the left is not it for a logical expression, and only the last
expression of a sequence passes its value on. `undefined` means `parent` is not one of those, so the
walk stops there.
*/
export function getExpressionValuePropagation(parent, child) {
	if (parent?.type === 'SequenceExpression') {
		return parent.expressions.at(-1) === child;
	}

	if (parent?.type === 'LogicalExpression') {
		return parent.right === child;
	}

	if (parent?.type === 'ConditionalExpression') {
		return parent.test !== child;
	}

	return undefined;
}

/**
Classify an expression whose value is thrown away at statement level: a bare statement (`fn();`), one
explicitly discarded with `void` (`void fn();`), or one whose value an enclosing conditional, logical, or
sequence expression hands to a statement that discards it (`x ? fn() : null;`).

`void` is not an escape hatch for a Promise-returning call — it evaluates the Promise and drops it, leaving it unhandled exactly like a bare statement — so callers report both.

Expression wrappers (optional chaining, TypeScript `as`/`satisfies`/`!`) are skipped on the way out, so a cast cannot hide a floating call. Returns `undefined` when the value is used (awaited, returned, assigned, …).

`canAwait` is `true` when prepending `await` to the call is a faithful fix. It is `false` for the `void` form (which would be left with a pointless `void await …`), for a call wrapped in a TypeScript type assertion (`as`/`satisfies`/`<T>`), which binds looser than `await`, and for an operand whose value a surrounding expression does not pass on. A call wrapped only in optional chaining or `!` stays fixable. Report the non-fixable forms without a fix.

@returns {{statement: import('estree').ExpressionStatement, canAwait: boolean} | undefined}
*/
export default function getFloatingStatement(node) {
	// Expression wrappers (optional chaining, TypeScript `as`/`satisfies`/`!`) are skipped on the way
	// out, so neither a cast on the call nor a cast on the statement can hide a floating call. The walk
	// starts from the call's outermost wrapper, so a wrapped call in a conditional's test is compared
	// as the test it is, and a caller that already passes that wrapper is read the same.
	let container = outermostExpressionWrapper(node);
	let parent = skipExpressionWrappers(container.parent);
	// Walk out of the `void`, conditional, logical, and sequence expressions that discard or pass on
	// this call's value, to the statement that discards it. A step that does not pass the value on
	// still leaves the call discarded, but one that cannot take an `await` in front of it.
	let canAwait = true;

	while (true) {
		// A `void` discards the value, so whatever the enclosing expression takes is still discarded.
		// It cannot take an `await`, which would be left as a pointless `void await …`.
		if (parent?.type === 'UnaryExpression' && parent.operator === 'void') {
			canAwait = false;
			container = parent;
			parent = skipExpressionWrappers(container.parent);
			continue;
		}

		const valuePropagates = getExpressionValuePropagation(parent, container);
		if (valuePropagates === undefined) {
			break;
		}

		canAwait &&= valuePropagates;
		container = outermostExpressionWrapper(parent);
		parent = skipExpressionWrappers(container.parent);
	}

	if (parent?.type !== 'ExpressionStatement') {
		return undefined;
	}

	return {
		statement: parent,
		canAwait: canAwait && !hasLooserBindThanAwait(parent.expression),
	};
}
