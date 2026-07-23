import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-deep-equal-with-primitive';

const DEEP_EQUAL_METHODS = new Map([
	['deepEqual', 'equal'],
	['deepStrictEqual', 'strictEqual'],
	['notDeepEqual', 'notEqual'],
	['notDeepStrictEqual', 'notStrictEqual'],
]);

/**
Check if a node represents a primitive value.
Covers: literals, `undefined`/`NaN`/`Infinity` identifiers, template literals (always a string,
regardless of interpolation), `void` expressions, and negated numeric/Infinity/NaN literals.
*/
function isPrimitive(node) {
	node = unwrapTypeScriptExpression(node);
	return (
		(node.type === 'Literal' && !node.regex)
		|| (node.type === 'Identifier' && ['undefined', 'NaN', 'Infinity'].includes(node.name))
		|| node.type === 'TemplateLiteral'
		|| (node.type === 'UnaryExpression' && node.operator === 'void')
		|| (
			node.type === 'UnaryExpression'
			&& node.operator === '-'
			&& (
				(node.argument.type === 'Literal' && !node.argument.regex)
				|| (node.argument.type === 'Identifier' && (node.argument.name === 'Infinity' || node.argument.name === 'NaN'))
			)
		)
	);
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

		const assertion = parseSupportedAssertionCall(node, imports, tracker);
		if (!assertion) {
			return;
		}

		const {method} = assertion;
		const replacement = DEEP_EQUAL_METHODS.get(method);
		if (!replacement) {
			return;
		}

		const [actual, expected] = node.arguments;
		if (!actual || !expected) {
			return;
		}

		if (!isPrimitive(actual) && !isPrimitive(expected)) {
			return;
		}

		const {callee} = node;
		const problem = {
			node,
			messageId: MESSAGE_ID,
			data: {method},
		};

		// Autofix only the member forms (`assert.deepEqual`, `t.assert.deepEqual`). A bare named
		// import (`deepEqual`) cannot be rewritten to `equal` without also importing it, so leave
		// it reported but unfixed.
		if (callee.type === 'MemberExpression') {
			problem.fix = fixer => fixer.replaceText(callee.property, replacement);
		}

		return problem;
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow `deepEqual`/`deepStrictEqual` (and their `notDeep*` variants) when comparing with primitives.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages: {
			[MESSAGE_ID]: 'Avoid using `{{method}}` with a primitive. Use the non-deep equality equivalent instead.',
		},
		languages: ['js/js'],
	},
};

export default config;
