import {isParenthesized} from './utils/index.js';

const MESSAGE_ID = 'consistent-assert-style';

const messages = {
	[MESSAGE_ID]: 'Prefer `{{expected}}` over `{{actual}}`.',
};

const ASSERT_MODULES = new Set(['node:assert', 'node:assert/strict', 'assert', 'assert/strict']);

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
			if (
				node.optional
				|| callee.type !== 'Identifier'
				|| isParenthesized(callee, context)
				|| !callableAssertReferences.has(callee)
			) {
				return;
			}

			return {
				node: callee,
				messageId: MESSAGE_ID,
				data: {
					expected: `${callee.name}.ok(…)`,
					actual: `${callee.name}(…)`,
				},
				fix: fixer => fixer.insertTextAfter(callee, '.ok'),
			};
		}

		if (
			node.optional
			|| callee.type !== 'MemberExpression'
			|| callee.optional
			|| callee.computed
			|| callee.object.type !== 'Identifier'
			|| callee.property.type !== 'Identifier'
			|| callee.property.name !== 'ok'
			|| isParenthesized(callee.object, context)
			|| !callableAssertReferences.has(callee.object)
		) {
			return;
		}

		const problem = {
			node: callee.property,
			messageId: MESSAGE_ID,
			data: {
				expected: `${callee.object.name}(…)`,
				actual: `${callee.object.name}.ok(…)`,
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
			recommended: false,
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
		defaultOptions: [{style: 'assert'}],
		messages,
		languages: ['js/js'],
	},
};

export default config;
