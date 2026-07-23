import {isTypeScriptExpressionWrapper} from './unwrap-typescript-expression.js';

/** Whether a node merely wraps an inner expression without consuming its value: optional chaining, or a TypeScript `as`/`satisfies`/`!` wrapper. */
export const isExpressionWrapper = node => node?.type === 'ChainExpression' || isTypeScriptExpressionWrapper(node);

/**
Walk from a node upward through `ChainExpression` (optional chaining) and TypeScript expression wrappers (`as`, `satisfies`, `!`). Returns the first ancestor that is neither.
*/
export default function skipExpressionWrappers(node) {
	while (isExpressionWrapper(node)) {
		node = node.parent;
	}

	return node;
}

/**
Walk from a node inward through `ChainExpression` (optional chaining) and TypeScript expression wrappers (`as`, `satisfies`, `!`). Returns the innermost wrapped expression, or the node itself when it is not wrapped.

This is the downward counterpart of `skipExpressionWrappers`: use it on a node you are about to inspect (a callee, an argument, an object), so `(foo as any)?.bar` reads the same as `foo.bar`. Passing `undefined` returns `undefined`.
*/
export function unwrapExpression(node) {
	while (isExpressionWrapper(node)) {
		node = node.expression;
	}

	return node;
}

/**
Walk from a node upward while its parent is an expression wrapper. Returns the outermost wrapper around `node`, or `node` itself when it has none.

Use this when the wrapper's own node matters (for example to keep the full `foo() as T` as the expression under inspection); use `skipExpressionWrappers` when only the enclosing expression matters.
*/
export function outermostExpressionWrapper(node) {
	while (isExpressionWrapper(node.parent)) {
		node = node.parent;
	}

	return node;
}
