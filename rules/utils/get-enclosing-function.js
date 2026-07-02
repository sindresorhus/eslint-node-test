import isFunction from '../ast/is-function.js';

/**
Walk up the ancestor chain to the nearest enclosing function node.
Returns `undefined` if the program root is reached first.

@param {import('estree').Node} node
@returns {import('estree').Function | undefined}
*/
export default function getEnclosingFunction(node) {
	for (let current = node.parent; current; current = current.parent) {
		if (isFunction(current)) {
			return current;
		}
	}

	return undefined;
}
