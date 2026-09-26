import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import {isPrimitive} from './utils/index.js';

const MESSAGE_ID = 'no-deep-equal-with-primitive';

const DEEP_EQUAL_METHODS = new Map([
	['deepEqual', 'equal'],
	['deepStrictEqual', 'strictEqual'],
	['notDeepEqual', 'notEqual'],
	['notDeepStrictEqual', 'notStrictEqual'],
]);

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

		if (!isPrimitive(actual, context) && !isPrimitive(expected, context)) {
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
		//
		// Only the strict pair is safe to autofix: `deepStrictEqual` and `strictEqual` agree on every
		// primitive. The loose pair (`deepEqual` -> `equal`) is not equivalent, because `==` coerces
		// a value that loose deep equality does not — `deepEqual(0, [])` fails while `equal(0, [])`
		// passes, and `deepEqual(new Number(1), 1)` fails while `equal(new Number(1), 1)` passes. Leave
		// the loose pair reported but unfixed.
		const isLoosePair = method === 'deepEqual' || method === 'notDeepEqual';
		if (callee.type === 'MemberExpression' && !isLoosePair) {
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
