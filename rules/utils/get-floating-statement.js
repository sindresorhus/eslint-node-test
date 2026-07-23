import skipExpressionWrappers from './skip-expression-wrappers.js';

// TypeScript type assertions bind looser than `await`, so `await call() as T` parses as
// `(await call()) as T` and casts the awaited value instead of the Promise. Optional chaining and
// the non-null `!` bind tighter, so a call wrapped only in those still takes an `await` faithfully.
const AWAIT_LOOSER_THAN = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion']);

/**
Classify an expression whose value is thrown away at statement level: a bare statement (`fn();`) or one explicitly discarded with `void` (`void fn();`).

`void` is not an escape hatch for a Promise-returning call — it evaluates the Promise and drops it, leaving it unhandled exactly like a bare statement — so callers report both.

Expression wrappers (optional chaining, TypeScript `as`/`satisfies`/`!`) are skipped on the way out, so a cast cannot hide a floating call. Returns `undefined` when the value is used (awaited, returned, assigned, …).

`canAwait` is `true` when prepending `await` to the call is a faithful fix. It is `false` for the `void` form (which would be left with a pointless `void await …`) and for a call wrapped in a TypeScript type assertion (`as`/`satisfies`/`<T>`), which binds looser than `await`. A call wrapped only in optional chaining or `!` stays fixable. Report the non-fixable forms without a fix.

@returns {{statement: import('estree').ExpressionStatement, canAwait: boolean} | undefined}
*/
export default function getFloatingStatement(node) {
	const parent = skipExpressionWrappers(node.parent);
	const isVoided = parent?.type === 'UnaryExpression' && parent.operator === 'void';
	const statement = isVoided ? skipExpressionWrappers(parent.parent) : parent;

	if (statement?.type !== 'ExpressionStatement') {
		return undefined;
	}

	const canAwait = !isVoided && !AWAIT_LOOSER_THAN.has(statement.expression.type);
	return {statement, canAwait};
}
