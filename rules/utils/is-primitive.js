import {findVariable} from '@eslint-community/eslint-utils';
import unwrapTypeScriptExpression from './unwrap-typescript-expression.js';
import isUnshadowedGlobal from './is-unshadowed-global.js';

/**
Check if a node represents a primitive value.

Covers: literals, the `undefined`/`NaN`/`Infinity` globals, template literals (always a string,
regardless of interpolation), and unary expressions (`typeof value`, `-x`, `void 0`), since every
unary operator yields a primitive.

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

	// Every unary operator yields a primitive, whatever its operand is: `typeof` a string, `!` and `delete` a boolean, `-`, `+` and `~` a number or bigint, and `void` `undefined`.
	return node.type === 'UnaryExpression';
}

/**
Whether the operand is a primitive VALUE, including one a binding holds when it is never reassigned and its initializer is written as a primitive: `equal(0, [])` passes while `deepEqual(0, [])` fails, so `const zero = 0` has to count as a literal `0` does. Any other value is left to the runtime, like any other unknown expression.

Use this rather than `isPrimitive` when the question is what the operand evaluates to; `isPrimitive`
answers only whether it is written as a primitive.
*/
export function isPrimitiveOperand(node, context) {
	if (isPrimitive(node, context)) {
		return true;
	}

	// Only a binding that is never reassigned and whose own initializer is written as a primitive counts. Resolving further, through a property read (`expected.list`) or another name bound to one, reads what the object literal said, which a later `Object.assign(expected, …)` or `fill(expected)` the checker cannot see may have replaced.
	const initializer = getConstantInitializer(node, context);
	return initializer !== undefined && isPrimitive(initializer, context);
}

/**
The initializer a name holds when that name is bound once, not destructured, and never reassigned, or `undefined`. Any other expression, including a property read, is not resolved.
*/
export function getConstantInitializer(node, context) {
	const unwrapped = unwrapTypeScriptExpression(node);
	if (unwrapped.type !== 'Identifier') {
		return undefined;
	}

	const variable = findVariable(context.sourceCode.getScope(unwrapped), unwrapped.name);
	const definition = variable?.defs.length === 1 ? variable.defs[0] : undefined;
	// A destructured binding (`const [...chars] = 'abc'`) is not the initializer's value.
	const isConstantBinding = definition?.type === 'Variable'
		&& definition.node.id.type === 'Identifier'
		&& Boolean(definition.node.init)
		&& variable.references.every(reference => reference.init || !reference.isWrite());
	return isConstantBinding ? definition.node.init : undefined;
}
