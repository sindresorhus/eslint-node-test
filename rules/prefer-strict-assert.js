import {
	resolveImports,
	parseAssertionCall,
	createContextTracker,
	isAssertionCallWithSupportedContext,
} from './utils/node-test.js';

const MESSAGE_ID = 'prefer-strict-assert';

const messages = {
	[MESSAGE_ID]: 'Prefer `{{replacement}}` over the legacy loose `{{method}}`.',
};

// Legacy loose (`==`) assertion methods and their strict equivalents.
const LOOSE_TO_STRICT = new Map([
	['equal', 'strictEqual'],
	['notEqual', 'notStrictEqual'],
	['deepEqual', 'deepStrictEqual'],
	['notDeepEqual', 'notDeepStrictEqual'],
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

		const assertion = parseAssertionCall(node, imports);
		// In a strict-mode assert module the legacy methods already behave strictly, so leave them.
		if (!assertion || assertion.isStrict || !isAssertionCallWithSupportedContext(node, tracker)) {
			return;
		}

		const replacement = LOOSE_TO_STRICT.get(assertion.method);
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
		// so leave it reported but unfixed.
		if (assertion.methodNode && assertion.methodNode !== node.callee) {
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
