import {isFunction} from '../ast/index.js';

/**
Check whether `node` or any of its descendants, excluding nested functions, is a suspension point (`await`, `for await…of`, or `yield`).

Nested functions are not descended into, since their suspension points belong to a different function.

@param {import('estree').Node} node
@param {import('eslint').SourceCode['visitorKeys']} visitorKeys
@returns {boolean}
*/
export default function containsSuspensionPoint(node, visitorKeys) {
	if (
		node.type === 'AwaitExpression'
		|| node.type === 'YieldExpression'
		|| (node.type === 'ForOfStatement' && node.await)
	) {
		return true;
	}

	if (isFunction(node)) {
		return false;
	}

	for (const key of visitorKeys[node.type] ?? []) {
		const child = node[key];
		// Branch on array vs. single child rather than normalizing with `[child]`: unlike the other AST walkers in this plugin, this one runs over every node of every async test body, so a wrapper array per child is worth avoiding.
		if (Array.isArray(child)) {
			for (const childNode of child) {
				if (childNode?.type && containsSuspensionPoint(childNode, visitorKeys)) {
					return true;
				}
			}
		} else if (child?.type && containsSuspensionPoint(child, visitorKeys)) {
			return true;
		}
	}

	return false;
}
