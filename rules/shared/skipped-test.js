import {getStaticValue} from '@eslint-community/eslint-utils';
import {
	findOptionsProperty,
	getCalleeChain,
	getEnclosingCallbackCalls,
	getRegistrationKind,
	getTestOptions,
	parseTestCall,
} from '../utils/node-test.js';

/*
Shared detection of a test whose callback `node:test` never runs: `test.skip(…)`, `test('a',
{skip: true}, …)`, and the standalone `skip(…)` export.

`node:test` swaps the callback for a no-op when the test is skipped, so a rule that reasons about what
the callback contains (its plan, its assertions) has nothing to say about a skipped one. A `todo` test
is not skipped: `node:test` runs its body and only marks the test as unfinished, so what the body
contains is still what runs.
*/

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
	// `parseTestCall` records every `.skip` modifier, chained (`test.skip(…)`, `describe.skip(…)`) or the standalone `skip` export, so the `parsed.modifiers` check covers each form. Only `skip` decides on its own, since a `todo` test still runs its body; `only(…)` and `todo(…)` run unless the options slot says otherwise. A suite reads `skip` the same way: a truthy one never runs the suite body, while a falsy one such as `{skip: 0}` runs the body and its `before`/`after` hooks and only cancels the tests it registers. Limitation: those cancelled tests are still read as running.
	return parsed?.modifiers.some(modifier => modifier.name === 'skip')
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

/**
Whether `call` registers a test, suite or subtest whose callback `node:test` never runs, read from its modifiers and its options. A hook, including a context hook, has neither, so it always runs its callback. `TestContext#test` has no `skip`, `todo` or `only` member, so any of them throws; they are read the way the modifiers of an imported `test` are, so only `t.test.skip(…)` counts as not running. Only a truthy `skip` option stops the body from running, see `hasEnabledSkipOption`.
*/
export function isSkippedRegistration(call, imports, context) {
	const kind = getRegistrationKind(call, imports, context);
	if (kind !== 'test' && kind !== 'suite') {
		return false;
	}

	const modifiers = parseTestCall(call, imports)?.modifiers ?? getCalleeChain(call.callee)?.members.slice(1) ?? [];
	return modifiers.some(modifier => modifier.name === 'skip')
		|| hasEnabledSkipOption(getTestOptions(call), context);
}

/**
Whether a registration that skips its callback encloses `node`, like `describe.skip('s', () => { test('a', body); })`. The node's own ancestors are read, which also covers an out-of-line body, visited where it is declared. A function named out of line (`describe.skip('s', suiteBody)`) is registered somewhere else, so the walk goes on from the call that registers it.
*/
export function isInsideSkippedRegistration(node, imports, context) {
	return getEnclosingCallbackCalls(node, context, imports)
		.some(call => isSkippedRegistration(call, imports, context));
}
