import {findVariable} from '@eslint-community/eslint-utils';
import {getStaticPropertyName, isSameReference, unwrapExpression} from './utils/index.js';
import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';

const MESSAGE_ID_ALWAYS_PASSES = 'no-identical-assertion-arguments/always-passes';
const MESSAGE_ID_ALWAYS_FAILS = 'no-identical-assertion-arguments/always-fails';

const messages = {
	[MESSAGE_ID_ALWAYS_PASSES]: 'Both arguments are the same, so this assertion always passes.',
	[MESSAGE_ID_ALWAYS_FAILS]: 'Both arguments are the same, so this assertion always fails.',
};

// Two-operand `node:assert` comparisons. The negated ones always fail on identical operands.
const POSITIVE_METHODS = new Set(['equal', 'strictEqual', 'deepEqual', 'deepStrictEqual', 'partialDeepStrictEqual']);
const NEGATED_METHODS = new Set(['notEqual', 'notStrictEqual', 'notDeepEqual', 'notDeepStrictEqual']);

// The deep methods compare structure, so two identical `RegExp` literals are the same value to them.
// The other methods compare identity, and two separate `RegExp` literals are always distinct objects,
// so the operands are not "the same reference" the messages rely on.
const STRUCTURAL_METHODS = new Set(['deepEqual', 'deepStrictEqual', 'notDeepEqual', 'notDeepStrictEqual']);

/** Whether a node is a `RegExp` literal. */
function isRegExpLiteral(node) {
	return node?.type === 'Literal' && Boolean(node.regex);
}

/** Whether a `Property`/`MethodDefinition` key matches `name`, ignoring quoting and computed-ness. */
function isKeyFor(property, name) {
	// A computed key that folds to a string names the same property: `{get ['value']() {}}` declares
	// the getter `o.value` reads.
	if (property.computed) {
		return getStaticPropertyName(property) === name;
	}

	return (property.key.type === 'Identifier' && property.key.name === name)
		|| (property.key.type === 'Literal' && property.key.value === name);
}

/** Whether `node` declares a getter named `name`, as an object literal or a class member. */
function hasGetterDeclaration(node, name) {
	let body;
	if (node?.type === 'ClassExpression' || node?.type === 'ClassDeclaration') {
		body = node.body.body;
	} else if (node?.type === 'ObjectExpression') {
		body = node.properties;
	}

	return Boolean(body?.some(member =>
		(member.type === 'Property' || member.type === 'MethodDefinition')
		&& member.kind === 'get'
		&& isKeyFor(member, name),
	));
}

/** Get the value a `Variable` definition is initialized with, which a declaration without one does not have. */
function getDefinitionValue(definitionNode) {
	return definitionNode.type === 'VariableDeclarator' ? definitionNode.init : definitionNode;
}

/** Get the class a `new C()` expression constructs, when it is resolvable. */
function getConstructedClass(node, sourceCode) {
	// A `let a;` declares the variable with no initializer, so there is no expression here at all.
	if (node?.type !== 'NewExpression' || node.callee.type !== 'Identifier') {
		return undefined;
	}

	const variable = findVariable(sourceCode.getScope(node), node.callee);
	return variable?.defs
		.map(definition => getDefinitionValue(definition.node))
		.find(definition => definition?.type === 'ClassDeclaration' || definition?.type === 'ClassExpression');
}

/**
Whether `x.y` reads a getter, which runs the accessor on every read.

Two reads of the same getter can return different values, so the assertion is not decided by
the operands being the same reference. This is the property-read equivalent of the rule already
skipping operands that contain a call.
*/
function readsAccessor(node, sourceCode) {
	// Unwrapped, the way `isSameReference` unwraps the operands it compares, so `a?.b` and `(a as any).b`
	// are read as the same property access as `a.b` rather than escaping the check.
	node = unwrapExpression(node);
	if (node.type !== 'MemberExpression') {
		return false;
	}

	// `o['value']` and `` o[`value`] `` name the same property as `o.value`.
	const propertyName = node.computed
		? getStaticPropertyName(node)
		: (node.property.type === 'Identifier' ? node.property.name : undefined);
	if (!propertyName) {
		return false;
	}

	// A wrapper on the receiver is unwrapped too: `(o as any).value` reads the same getter as `o.value`.
	const object = unwrapExpression(node.object);

	// `new C().value` — the receiver is the constructed class, not a variable.
	if (hasGetterDeclaration(getConstructedClass(object, sourceCode), propertyName)) {
		return true;
	}

	if (object.type !== 'Identifier') {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(object), object);
	return Boolean(variable) && variable.defs.some(definition => {
		const value = getDefinitionValue(definition.node);
		return hasGetterDeclaration(value, propertyName)
			|| hasGetterDeclaration(getConstructedClass(value, sourceCode), propertyName);
	});
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	// Activate on a `node:assert` import, or in a test file where `t.assert.*` may be used.
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const assertion = parseSupportedAssertionCall(node, imports, tracker);
		if (!assertion) {
			return;
		}

		const isNegated = NEGATED_METHODS.has(assertion.method);
		if (!isNegated && !POSITIVE_METHODS.has(assertion.method)) {
			return;
		}

		const [first, second] = node.arguments;
		if (
			!first
			|| !second
			|| first.type === 'SpreadElement'
			|| second.type === 'SpreadElement'
		) {
			return;
		}

		if (!isSameReference(first, second)) {
			return;
		}

		// Two distinct `RegExp` literals are different objects, so a reference comparison of them is
		// not the "same value" case this rule reports. Only the deep methods, which compare structure,
		// treat identical patterns as equal.
		if (!STRUCTURAL_METHODS.has(assertion.method) && isRegExpLiteral(first) && isRegExpLiteral(second)) {
			return;
		}

		if (readsAccessor(first, sourceCode) || readsAccessor(second, sourceCode)) {
			return;
		}

		return {
			node,
			messageId: isNegated ? MESSAGE_ID_ALWAYS_FAILS : MESSAGE_ID_ALWAYS_PASSES,
		};
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
			description: 'Disallow comparing a value to itself in an assertion.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
