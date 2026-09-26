import {getStaticValue} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import {isPrimitive} from './utils/index.js';

const PRIMITIVE_TYPES = new Set(['string', 'number', 'boolean', 'bigint', 'symbol']);

/**
Whether the operand is a primitive, including one a name holds: `equal(0, [])` passes while
`deepEqual(0, [])` fails, so a `0` reached through a variable has to withhold the fix as a literal
does. A value the checker cannot resolve is left to the runtime, like any other unknown expression.
*/
function isPrimitiveOperand(node, context) {
	if (isPrimitive(node, context)) {
		return true;
	}

	const resolved = getStaticValue(unwrapTypeScriptExpression(node), context.sourceCode.getScope(node));
	return resolved !== null && PRIMITIVE_TYPES.has(typeof resolved.value);
}

const MESSAGE_ID = 'no-incorrect-strict-equal';

// Strict/loose equality methods and their deep equivalents.
const STRICT_TO_DEEP = new Map([
	['equal', 'deepEqual'],
	['strictEqual', 'deepStrictEqual'],
	['notEqual', 'notDeepEqual'],
	['notStrictEqual', 'notDeepStrictEqual'],
]);

/**
Check if a node is an object or array literal. These are freshly allocated, so a strict/loose
equality comparison against them is decided purely by reference identity, never by structure.
*/
function isObjectOrArrayLiteral(node) {
	const unwrapped = unwrapTypeScriptExpression(node);
	return unwrapped.type === 'ObjectExpression' || unwrapped.type === 'ArrayExpression';
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

		const replacement = STRICT_TO_DEEP.get(assertion.method);
		if (!replacement) {
			return;
		}

		const [actual, expected] = node.arguments;
		if (!actual || !expected) {
			return;
		}

		if (!isObjectOrArrayLiteral(actual) && !isObjectOrArrayLiteral(expected)) {
			return;
		}

		const {callee} = node;
		const problem = {
			node,
			messageId: MESSAGE_ID,
			data: {method: assertion.method, replacement},
		};

		// Autofix only the member forms (`assert.strictEqual`, `t.assert.strictEqual`). A bare named
		// import (`strictEqual`) cannot be rewritten to `deepStrictEqual` without also importing it,
		// so leave it reported but unfixed.
		//
		// Only autofix when neither argument is a primitive. With a primitive on one side and a fresh
		// object or array literal on the other, `==` and loose deep equality diverge: `equal(0, [])`
		// passes while `deepEqual(0, [])` fails. Fixing there would also fight
		// `no-incorrect-deep-equal`, which rewrites the opposite direction, so the two fixers would
		// not converge. Leave that case reported but unfixed.
		if (callee.type === 'MemberExpression' && !isPrimitiveOperand(actual, context) && !isPrimitiveOperand(expected, context)) {
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
			description: 'Disallow `strictEqual`/`equal` (and their `not*` variants) when comparing with an object or array literal.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages: {
			[MESSAGE_ID]: 'Avoid using `{{method}}` with an object or array literal. Use `{{replacement}}` to compare by structure instead.',
		},
		languages: ['js/js'],
	},
};

export default config;
