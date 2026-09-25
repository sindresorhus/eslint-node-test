import unwrapTypeScriptExpression from './unwrap-typescript-expression.js';

/**
Check if a node represents a primitive value.
Covers: literals, `undefined`/`NaN`/`Infinity` identifiers, template literals (always a string,
regardless of interpolation), `void` expressions, and signed numeric/Infinity/NaN literals, since
`-0` and `+0` are primitives just as `0` is.
*/
export default function isPrimitive(node) {
	node = unwrapTypeScriptExpression(node);
	return (
		(node.type === 'Literal' && !node.regex)
		|| (node.type === 'Identifier' && ['undefined', 'NaN', 'Infinity'].includes(node.name))
		|| node.type === 'TemplateLiteral'
		|| (node.type === 'UnaryExpression' && node.operator === 'void')
		|| (
			node.type === 'UnaryExpression'
			&& (node.operator === '-' || node.operator === '+')
			&& (
				(node.argument.type === 'Literal' && !node.argument.regex)
				|| (node.argument.type === 'Identifier' && (node.argument.name === 'Infinity' || node.argument.name === 'NaN'))
			)
		)
	);
}
