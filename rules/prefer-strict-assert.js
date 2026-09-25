import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
	LOOSE_TO_STRICT_METHODS,
} from './utils/node-test.js';
import {unwrapExpression} from './utils/index.js';

const MESSAGE_ID = 'prefer-strict-assert';

const messages = {
	[MESSAGE_ID]: 'Prefer `{{replacement}}` over the legacy loose `{{method}}`.',
};

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
		// In a strict-mode assert module the legacy methods already behave strictly, so leave them.
		if (!assertion || assertion.isStrict) {
			return;
		}

		const replacement = LOOSE_TO_STRICT_METHODS.get(assertion.method);
		if (!replacement) {
			return;
		}

		const problem = {
			node,
			messageId: MESSAGE_ID,
			data: {method: assertion.method, replacement},
		};

		// Autofix only the member forms (`assert.equal`, `t.assert.equal`). A bare named
		// import (`equal`) cannot be rewritten to `strictEqual` without also importing it,
		// so leave it reported but unfixed. The callee is unwrapped first, so a cast around a
		// bare import is left unfixed too, exactly like the bare import it erases to.
		if (assertion.methodNode && assertion.methodNode !== unwrapExpression(node.callee)) {
			problem.fix = fixer => fixer.replaceText(assertion.methodNode, replacement);
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
			description: 'Prefer strict assertion methods over their legacy loose counterparts.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
