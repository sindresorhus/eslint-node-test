import {getStaticValue} from '@eslint-community/eslint-utils';
import {findOptionsProperty, getTestOptions} from '../utils/node-test.js';
import unwrapTypeScriptExpression from '../utils/unwrap-typescript-expression.js';

/*
Shared detection of a test whose callback `node:test` never runs: `test.skip(…)`, `test('a',
{skip: true}, …)`, and the standalone `skip(…)` export.

`node:test` swaps the callback for a no-op when the test is skipped, so a rule that reasons about what
the callback contains (its plan, its assertions) has nothing to say about a skipped one. A `todo` test
is not skipped: `node:test` runs its body and only marks the test as unfinished, so what the body
contains is still what runs.
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
`node:test` marks a test `# SKIP` for any value that is neither `undefined` nor `false`, so `{skip: 0}`
carries the directive. Only a truthy value stops the body from running, though, and a body that runs is
a body these rules can reason about: `{skip: 0}`, `{skip: ''}` and `{skip: null}` all still run their
callback. The result still carries `# SKIP`, so a throw in one is reported as `not ok … # SKIP` without
counting as a failure, but the code in the body really runs. A value that cannot be resolved statically proves
nothing either way, so the test is treated as running.

@param {object | undefined} optionsObject The options object of the call, as `getTestOptions` returns it.
@param {import('eslint').Rule.RuleContext} context
@returns {boolean} Whether the options object skips the test body.
*/
export function hasEnabledSkipOption(optionsObject, context) {
	const property = findOptionsProperty(optionsObject, 'skip');
	if (property === undefined) {
		return false;
	}

	const staticValue = getStaticValue(property.value, context.sourceCode.getScope(property.value));
	return staticValue !== null && Boolean(staticValue.value);
}

/**
Whether `node` is a test call that is statically skipped.

@param {import('estree').CallExpression} node
@param {object | undefined} parsed The `parseTestCall` result for `node`.
@param {import('eslint').Rule.RuleContext} context
*/
export function isSkippedTestCall(node, parsed, context) {
	// The standalone `skip`/`todo` exports have an `Identifier` callee, so the member walk cannot see
	// them. `parseTestCall` records the modifier for that form, so the `parsed.modifiers` check covers
	// it. Only `skip` decides on its own, since a `todo` test still runs its body; `only(…)` and
	// `todo(…)` run unless the options slot says otherwise.
	return hasSkipModifier(node.callee)
		|| parsed?.modifiers.some(modifier => modifier.name === 'skip')
		|| hasEnabledSkipOption(getTestOptions(node), context);
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
