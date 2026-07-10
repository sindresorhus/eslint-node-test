import quoteJsString from 'quote-js-string';
import {
	resolveImports,
	parseTestCall,
	getTestOptions,
	MODIFIERS,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID_NOT_ARRAY = 'valid-test-tags/not-array';
const MESSAGE_ID_HOLE = 'valid-test-tags/hole';
const MESSAGE_ID_NOT_STRING = 'valid-test-tags/not-string';
const MESSAGE_ID_EMPTY = 'valid-test-tags/empty';
const MESSAGE_ID_LOWERCASE = 'valid-test-tags/lowercase';
const MESSAGE_ID_DUPLICATE = 'valid-test-tags/duplicate';
const TEST_AND_SUITE_MODIFIERS = new Set(['expectFailure', ...MODIFIERS]);

const messages = {
	[MESSAGE_ID_NOT_ARRAY]: '`tags` must be an array.',
	[MESSAGE_ID_HOLE]: '`tags` must not contain empty slots.',
	[MESSAGE_ID_NOT_STRING]: 'Tag values must be strings.',
	[MESSAGE_ID_EMPTY]: 'Tag values must not be empty.',
	[MESSAGE_ID_LOWERCASE]: 'Tag `{{tag}}` must use its lowercase canonical form.',
	[MESSAGE_ID_DUPLICATE]: 'Duplicate tag `{{tag}}`.',
};

function isTagsProperty(property) {
	return (
		property.type === 'Property'
		&& !property.computed
		&& (
			(property.key.type === 'Identifier' && property.key.name === 'tags')
			|| (property.key.type === 'Literal' && property.key.value === 'tags')
		)
	);
}

function getTagsProperty(options) {
	for (let index = options.properties.length - 1; index >= 0; index -= 1) {
		const property = options.properties[index];
		if (isTagsProperty(property)) {
			return property.kind === 'init' ? property : undefined;
		}

		if (property.type === 'SpreadElement' || property.computed) {
			return;
		}
	}
}

function getStaticString(node) {
	node = unwrapTypeScriptExpression(node);
	if (node.type === 'Literal' && typeof node.value === 'string') {
		return {node, value: node.value};
	}

	if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
		const value = node.quasis[0].value.cooked;
		if (typeof value === 'string') {
			return {node, value};
		}
	}
}

function isStaticValue(node) {
	node = unwrapTypeScriptExpression(node);
	return (
		node.type === 'Literal'
		|| (node.type === 'TemplateLiteral' && node.expressions.length === 0)
		|| node.type === 'ArrayExpression'
		|| node.type === 'ObjectExpression'
		|| node.type === 'FunctionExpression'
		|| node.type === 'ArrowFunctionExpression'
		|| node.type === 'ClassExpression'
		|| (
			node.type === 'UnaryExpression'
			&& (node.operator === '+' || node.operator === '-')
			&& unwrapTypeScriptExpression(node.argument).type === 'Literal'
		)
	);
}

function getLowercaseFix(node, value) {
	const quote = node.type === 'Literal' ? node.raw[0] : '\'';
	return fixer => fixer.replaceText(node, quoteJsString(value.toLowerCase(), quote));
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	context.on('CallExpression', function * (node) {
		const parsed = parseTestCall(node, imports);
		if (
			(parsed?.kind !== 'test' && parsed?.kind !== 'suite')
			|| parsed.modifiers.some(modifier => !TEST_AND_SUITE_MODIFIERS.has(modifier.name))
		) {
			return;
		}

		const options = getTestOptions(node);
		const tagsProperty = options && getTagsProperty(options);
		if (!tagsProperty) {
			return;
		}

		const tags = unwrapTypeScriptExpression(tagsProperty.value);
		if (tags.type !== 'ArrayExpression') {
			if (isStaticValue(tags)) {
				yield {
					node: tags,
					messageId: MESSAGE_ID_NOT_ARRAY,
				};
			}

			return;
		}

		const seenTags = new Set();
		for (const rawElement of tags.elements) {
			if (rawElement === null) {
				yield {
					node: tags,
					messageId: MESSAGE_ID_HOLE,
				};
				continue;
			}

			if (rawElement.type === 'SpreadElement') {
				continue;
			}

			const tag = getStaticString(rawElement);
			if (!tag) {
				if (isStaticValue(rawElement)) {
					yield {
						node: rawElement,
						messageId: MESSAGE_ID_NOT_STRING,
					};
				}

				continue;
			}

			if (tag.value === '') {
				yield {
					node: tag.node,
					messageId: MESSAGE_ID_EMPTY,
				};
				continue;
			}

			const normalizedTag = tag.value.toLowerCase();
			if (tag.value !== normalizedTag) {
				yield {
					node: tag.node,
					messageId: MESSAGE_ID_LOWERCASE,
					data: {tag: tag.value},
					fix: getLowercaseFix(tag.node, tag.value),
				};
			}

			if (seenTags.has(normalizedTag)) {
				yield {
					node: tag.node,
					messageId: MESSAGE_ID_DUPLICATE,
					data: {tag: normalizedTag},
				};
				continue;
			}

			seenTags.add(normalizedTag);
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Require valid test tags.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
