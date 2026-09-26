import {getStaticValue} from '@eslint-community/eslint-utils';
import unwrapTypeScriptExpression from './unwrap-typescript-expression.js';
import isUnshadowedGlobal from './is-unshadowed-global.js';

const PRIMITIVE_TYPES = new Set(['string', 'number', 'boolean', 'bigint', 'symbol']);

/**
Check if a node represents a primitive value.

Covers: literals, the `undefined`/`NaN`/`Infinity` globals, template literals (always a string,
regardless of interpolation), `void` expressions, and signed numeric/Infinity/NaN literals, since
`-0` and `+0` are primitives just as `0` is.

The three names are only primitives while nothing shadows them: `const NaN = {}` is an object, and a
`no-incorrect-deep-equal` fix built on that would turn a passing deep comparison into a failing
reference one. Any other expression may be a primitive at runtime and is left to it.
*/
export default function isPrimitive(node, context) {
	node = unwrapTypeScriptExpression(node);
	if (node.type === 'Literal') {
		return !node.regex;
	}

	if (node.type === 'Identifier') {
		return ['undefined', 'NaN', 'Infinity'].includes(node.name) && isUnshadowedGlobal(context, node, node.name);
	}

	if (node.type === 'TemplateLiteral') {
		return true;
	}

	if (node.type === 'UnaryExpression') {
		if (node.operator === 'void') {
			return true;
		}

		// Every other unary operator applies to its operand, so the operand decides.
		if (node.operator !== '-' && node.operator !== '+') {
			return false;
		}

		const {argument} = node;
		return (argument.type === 'Literal' && !argument.regex)
			|| (argument.type === 'Identifier'
				&& ['Infinity', 'NaN'].includes(argument.name)
				&& isUnshadowedGlobal(context, argument, argument.name));
	}

	return false;
}

/**
Whether the operand is a primitive VALUE, including one a name holds: `equal(0, [])` passes while
`deepEqual(0, [])` fails, so a `0` reached through a variable has to count as a literal `0` does. A
value the checker cannot resolve is left to the runtime, like any other unknown expression.

Use this rather than `isPrimitive` when the question is what the operand evaluates to; `isPrimitive`
answers only whether it is written as a primitive.
*/
export function isPrimitiveOperand(node, context) {
	if (isPrimitive(node, context)) {
		return true;
	}

	const resolved = getStaticValue(unwrapTypeScriptExpression(node), context.sourceCode.getScope(node));
	return resolved !== null && PRIMITIVE_TYPES.has(typeof resolved.value);
}
