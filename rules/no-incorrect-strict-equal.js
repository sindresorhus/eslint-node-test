import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

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
			description: 'Disallow `strictEqual`/`equal` (and their `not*` variants) when comparing with an object or array literal.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages: {
			[MESSAGE_ID]: 'Avoid using `{{method}}` with an object or array literal, which compares by reference rather than structure. Use `{{replacement}}` instead.',
		},
		languages: ['js/js'],
	},
};

export default config;
