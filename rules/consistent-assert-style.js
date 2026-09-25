import {isParenthesized} from './utils/index.js';
import {ASSERT_MODULES} from './utils/node-test.js';

const MESSAGE_ID = 'consistent-assert-style';

const messages = {
	[MESSAGE_ID]: 'Prefer `{{expected}}` over `{{actual}}`.',
};

function isValueImport(node) {
	return node.importKind === undefined || node.importKind === 'value';
}

function isCallableAssertSpecifier(specifier) {
	if (!isValueImport(specifier)) {
		return false;
	}

	if (specifier.type === 'ImportDefaultSpecifier') {
		return true;
	}

	if (
		specifier.type !== 'ImportSpecifier'
		|| specifier.imported.type !== 'Identifier'
	) {
		return false;
	}

	return specifier.imported.name === 'default'
		|| specifier.imported.name === 'strict';
}

function getCallableAssertReferences(context) {
	const {sourceCode} = context;
	const references = new Set();

	for (const node of sourceCode.ast.body) {
		if (
			node.type !== 'ImportDeclaration'
			|| typeof node.source.value !== 'string'
			|| !ASSERT_MODULES.has(node.source.value)
			|| !isValueImport(node)
		) {
			continue;
		}

		for (const specifier of node.specifiers) {
			addCallableAssertReferences(sourceCode, specifier, references);
		}
	}

	return references;
}

function addCallableAssertReferences(sourceCode, specifier, references) {
	if (!isCallableAssertSpecifier(specifier)) {
		return;
	}

	const [variable] = sourceCode.getDeclaredVariables(specifier);
	if (!variable) {
		return;
	}

	for (const reference of variable.references) {
		references.add(reference.identifier);
	}
}

/**
The text of the callable assert a call reaches, or `undefined` when it is not one.

`node:assert` exposes two callable forms: the module itself (`assert(…)`, `assert.ok(…)`) and its
strict view (`assert.strict(…)`, `assert.strict.ok(…)`). Both are truthiness assertions, so the rule
covers both in each style.
*/
function getCallableAssertText(callee, context, callableAssertReferences) {
	const {sourceCode} = context;

	if (
		callee.type === 'Identifier'
		&& !isParenthesized(callee, context)
		&& callableAssertReferences.has(callee)
	) {
		return sourceCode.getText(callee);
	}

	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& !callee.optional
		&& callee.property.type === 'Identifier'
		&& callee.property.name === 'strict'
		&& callee.object.type === 'Identifier'
		// The fix deletes the range from the end of `assert.strict` to the end of `ok`, which a
		// parenthesis around either of them sits inside.
		&& !isParenthesized(callee.object, context)
		&& !isParenthesized(callee, context)
		&& callableAssertReferences.has(callee.object)
	) {
		return sourceCode.getText(callee);
	}
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const {style} = context.options[0];
	const callableAssertReferences = getCallableAssertReferences(context);

	if (callableAssertReferences.size === 0) {
		return;
	}

	context.on('CallExpression', node => {
		const {callee} = node;

		if (style === 'assert-ok') {
			if (node.optional) {
				return;
			}

			const callableText = getCallableAssertText(callee, context, callableAssertReferences);
			if (!callableText) {
				return;
			}

			return {
				node: callee,
				messageId: MESSAGE_ID,
				data: {
					expected: `${callableText}.ok(…)`,
					actual: `${callableText}(…)`,
				},
				fix: fixer => fixer.insertTextAfter(callee, '.ok'),
			};
		}

		if (
			node.optional
			|| callee.type !== 'MemberExpression'
			|| isParenthesized(callee, context)
			|| callee.optional
			|| callee.computed
			|| callee.property.type !== 'Identifier'
			|| callee.property.name !== 'ok'
		) {
			return;
		}

		const callableText = getCallableAssertText(callee.object, context, callableAssertReferences);
		if (!callableText) {
			return;
		}

		const problem = {
			node: callee.property,
			messageId: MESSAGE_ID,
			data: {
				expected: `${callableText}(…)`,
				actual: `${callableText}.ok(…)`,
			},
		};

		if (sourceCode.getCommentsInside(callee).length === 0) {
			problem.fix = fixer => fixer.removeRange([
				sourceCode.getRange(callee.object)[1],
				sourceCode.getRange(callee.property)[1],
			]);
		}

		return problem;
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Enforce a consistent truthiness assertion style.',
			recommended: true,
		},
		fixable: 'code',
		schema: [
			{
				type: 'object',
				properties: {
					style: {
						enum: ['assert', 'assert-ok'],
						description: 'Whether truthiness assertions should use `assert(…)` or `assert.ok(…)`.',
					},
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{style: 'assert-ok'}],
		messages,
		languages: ['js/js'],
	},
};

export default config;
