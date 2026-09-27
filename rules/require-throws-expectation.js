import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'require-throws-expectation';

// The two primitives that are identifiers rather than literals, so the literal check above misses them.
const PRIMITIVE_IDENTIFIERS = new Set(['NaN', 'Infinity']);

const messages = {
	[MESSAGE_ID]: '`{{method}}()` accepts any thrown value. Pass an error matcher (error class, `RegExp`, validation object, or function) as the second argument.',
};

const THROWS_METHODS = new Set(['throws', 'rejects']);

/**
Whether the matcher slot holds what `node:assert` reads as no matcher at all, which matches any
thrown value. `undefined` is an identifier in the AST and `null` a literal, and `void anything`
evaluates to `undefined`, so all three read the same way.
*/
function isNoMatcher(node) {
	return node === undefined
		|| (node.type === 'Identifier' && node.name === 'undefined')
		|| (node.type === 'UnaryExpression' && node.operator === 'void')
		|| (node.type === 'Literal' && node.value === null);
}

/**
Whether the matcher slot holds something `node:assert` refuses: a primitive, which it rejects with
`ERR_INVALID_ARG_TYPE` once the function has run, or an empty object or array, which it rejects with
`ERR_INVALID_ARG_VALUE` once an error has been caught.

A primitive is rejected however it is written, so `-1`, `!0` and `NaN` are unusable matchers just as
`0` is; every unary expression but `void`, which is the no-matcher case, evaluates to one. A `RegExp`
literal and a string are the two literals `node:assert` does accept; a string is
`no-assert-throws-string`'s case, and a `RegExp` is a real matcher.
*/
function isUnusableMatcher(node) {
	if (node.type === 'Literal') {
		return !node.regex && typeof node.value !== 'string';
	}

	return (node.type === 'Identifier' && PRIMITIVE_IDENTIFIERS.has(node.name))
		|| (node.type === 'UnaryExpression' && node.operator !== 'void')
		|| (node.type === 'ObjectExpression' && hasNoOwnKeys(node))
		|| (node.type === 'ArrayExpression' && node.elements.length === 0);
}

/**
Whether an object literal has no own keys, which is what `node:assert` calls an empty object.

A plain `__proto__: value` property sets the prototype rather than adding a key, so `{__proto__: null}`
has none either and is rejected the same way `{}` is, and so is the string-keyed `{'__proto__': null}`. A
computed `{['__proto__']: value}`, the shorthand `{__proto__}`, a method `{__proto__() {}}` and an
accessor `{get __proto__() {}}` all add an ordinary own key, and so does a spread, so none of them is empty.
*/
function hasNoOwnKeys(node) {
	return node.properties.every(property =>
		property.type === 'Property'
		&& property.kind === 'init'
		&& !property.method
		&& !property.computed
		&& !property.shorthand
		&& (property.key.type === 'Identifier' ? property.key.name : property.key.value) === '__proto__');
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const parsed = parseSupportedAssertionCall(node, imports, tracker);
		if (!parsed || !THROWS_METHODS.has(parsed.method)) {
			return;
		}

		// The single-argument form has no matcher at all, and an explicit `undefined` or `null` is
		// what `node:test`'s `assert` treats as no matcher: both match any thrown value. A spread
		// could expand to a matcher, and any other expression may be one at runtime.
		const [first] = node.arguments;
		// A call with no arguments at all is an arity problem, which `assertion-arguments` reports.
		if (!first || first.type === 'SpreadElement') {
			return;
		}

		const second = node.arguments[1] && unwrapTypeScriptExpression(node.arguments[1]);
		if (second?.type === 'SpreadElement') {
			return;
		}

		if (isNoMatcher(second)) {
			return {
				node,
				messageId: MESSAGE_ID,
				data: {method: parsed.method},
			};
		}

		if (isUnusableMatcher(second)) {
			return {
				node: second,
				messageId: MESSAGE_ID,
				data: {method: parsed.method},
			};
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Require an error matcher for `assert.throws()`/`assert.rejects()`.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
