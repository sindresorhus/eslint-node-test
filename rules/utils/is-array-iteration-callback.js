// Array methods that run their first argument once per item, where the call is written.
const ITERATION_METHODS = new Set(['forEach', 'map', 'flatMap']);

/**
Whether a function is the callback of an array-iteration call (`items.forEach(item => …)`), which runs where the call is written, so what it registers belongs to the enclosing scope, the same as a `for…of` body.

@param {import('estree').Function} node
@returns {boolean}
*/
export default function isArrayIterationCallback(node) {
	const {parent} = node;
	return parent?.type === 'CallExpression'
		&& parent.arguments[0] === node
		&& parent.callee.type === 'MemberExpression'
		&& !parent.callee.computed
		&& ITERATION_METHODS.has(parent.callee.property.name);
}
