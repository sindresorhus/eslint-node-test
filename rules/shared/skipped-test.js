import {getStaticValue} from '@eslint-community/eslint-utils';
import {findOptionsProperty, getTestOptions} from '../utils/node-test.js';
import unwrapTypeScriptExpression from '../utils/unwrap-typescript-expression.js';

/*
Shared detection of a test whose callback `node:test` never runs: `test.skip(…)`, `test('a',
{skip: true}, …)`, and the standalone `skip(…)`/`todo(…)` exports.

`node:test` swaps the callback for a no-op when the test is skipped, so a rule that reasons about what
the callback contains (its plan, its assertions) has nothing to say about a skipped one.
*/

/** Whether the callee chain carries a `.skip` segment, as in `test.skip(…)` or `skip.only(…)`. */
function hasSkipModifier(node) {
	node = unwrapTypeScriptExpression(node);

	while (node.type === 'MemberExpression') {
		if (
			!node.computed
			&& node.property.type === 'Identifier'
			&& node.property.name === 'skip'
		) {
			return true;
		}

		node = unwrapTypeScriptExpression(node.object);
	}

	return false;
}

/*
`node:test` skips for any value that is neither `undefined` nor `false`, so `{skip: 0}` skips and
`{skip: false}` does not. A value that cannot be resolved proves nothing, so the test is treated as
running: these rules report what is inside a test body, and code that may never run has no plan to
get wrong.
*/
function hasEnabledSkipOption(node, context) {
	const property = findOptionsProperty(getTestOptions(node), 'skip');
	if (property === undefined) {
		return false;
	}

	const staticValue = getStaticValue(property.value, context.sourceCode.getScope(property.value));
	return staticValue !== null && staticValue.value !== undefined && staticValue.value !== false;
}

/**
Whether `node` is a test call that is statically skipped.

@param {import('estree').CallExpression} node
@param {object | undefined} parsed The `parseTestCall` result for `node`.
@param {import('eslint').Rule.RuleContext} context
*/
export function isSkippedTestCall(node, parsed, context) {
	// The standalone `skip(…)`/`todo(…)` exports have an `Identifier` callee, so the member walk
	// cannot see them. `parseTestCall` records the modifier for that form. Only those two decide on
	// their own; `only(…)` runs unless the options slot says otherwise, so fall through.
	if (
		parsed?.hasStandaloneModifier
		&& parsed.modifiers.some(modifier => modifier.name === 'skip' || modifier.name === 'todo')
	) {
		return true;
	}

	return hasSkipModifier(node.callee)
		|| parsed?.modifiers.some(modifier => modifier.name === 'skip')
		|| hasEnabledSkipOption(node, context);
}

/** Whether `node` sits inside one of the callbacks collected in `skippedCallbacks`. */
export function isInsideSkippedCallback(node, skippedCallbacks) {
	// Walking to the root is the expensive part of visiting a call, and most files skip nothing.
	if (skippedCallbacks.size === 0) {
		return false;
	}

	for (let current = node; current; current = current.parent) {
		if (skippedCallbacks.has(current)) {
			return true;
		}
	}

	return false;
}
