const typeScriptExpressionWrapperTypes = new Set([
	'TSAsExpression',
	'TSInstantiationExpression',
	'TSSatisfiesExpression',
	'TSNonNullExpression',
	'TSTypeAssertion',
]);

export const isTypeScriptExpressionWrapper = node => typeScriptExpressionWrapperTypes.has(node?.type);

// A type assertion binds looser than `await`, so `await value as T` parses as `(await value) as T`
// and casts the awaited value instead of the Promise. The `!` and `?.` wrappers bind tighter, so a
// call wrapped only in those still takes a prepended `await` faithfully.
const awaitLooserWrapperTypes = new Set([
	'TSAsExpression',
	'TSSatisfiesExpression',
	'TSTypeAssertion',
]);

/** Whether a node is a wrapper that binds looser than `await`, so prepending `await` would change what it applies to. */
export const hasLooserBindThanAwait = node => awaitLooserWrapperTypes.has(node?.type);

export default function unwrapTypeScriptExpression(node) {
	while (isTypeScriptExpressionWrapper(node)) {
		node = node.expression;
	}

	return node;
}
