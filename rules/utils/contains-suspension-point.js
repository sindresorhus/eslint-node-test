import {isFunction} from '../ast/index.js';

/** Whether `node` is itself a suspension point, rather than merely containing one. */
function isSuspensionPoint(node, includeYield) {
	return node.type === 'AwaitExpression'
		|| (includeYield && node.type === 'YieldExpression')
		|| (node.type === 'ForOfStatement' && node.await)
		// An `await using` declaration suspends while it acquires the resource, without an
		// `AwaitExpression` node of its own.
		|| (node.type === 'VariableDeclaration' && node.kind === 'await using');
}

/**
Check whether `node` or any of its descendants, excluding nested functions, is a suspension point (`await`, an `await using` declaration, `for await…of`, or `yield`).

Nested functions are not descended into, since their suspension points belong to a different function.

Pass `includeYield: false` to ignore `yield`. In a sync generator a `yield` suspends synchronously, so a caller asking "does this code run asynchronously" (rather than "does this code suspend") wants it excluded. In an async generator a `yield` awaits its operand, so such a caller should include it there.

@param {import('estree').Node} node
@param {import('eslint').SourceCode['visitorKeys']} visitorKeys
@param {{includeYield?: boolean}} [options]
@returns {boolean}
*/
export default function containsSuspensionPoint(node, visitorKeys, {includeYield = true} = {}) {
	if (isSuspensionPoint(node, includeYield)) {
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
				if (childNode?.type && containsSuspensionPoint(childNode, visitorKeys, {includeYield})) {
					return true;
				}
			}
		} else if (child?.type && containsSuspensionPoint(child, visitorKeys, {includeYield})) {
			return true;
		}
	}

	return false;
}
