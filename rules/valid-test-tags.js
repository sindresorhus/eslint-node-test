import quoteJsString from 'quote-js-string';
import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	getTestOptions,
	MODIFIERS,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID_NOT_ARRAY = 'valid-test-tags/not-array';
const MESSAGE_ID_HOLE = 'valid-test-tags/hole';
const MESSAGE_ID_NOT_STRING = 'valid-test-tags/not-string';
const MESSAGE_ID_EMPTY = 'valid-test-tags/empty';
const MESSAGE_ID_LOWERCASE = 'valid-test-tags/lowercase';
const MESSAGE_ID_FORBIDDEN = 'valid-test-tags/forbidden-character';
const MESSAGE_ID_RESERVED = 'valid-test-tags/reserved-word';
const MESSAGE_ID_DUPLICATE = 'valid-test-tags/duplicate';
const TEST_AND_SUITE_MODIFIERS = new Set(['expectFailure', ...MODIFIERS]);

/*
The characters `node:test` rejects in a tag. The whitespace set is the runner's own six code points
(tab, line feed, vertical tab, form feed, carriage return, space) rather than `\s`, which would also
match a non-breaking space and the other Unicode spaces `node:test` accepts. `*` is not one of the
break characters the tag-filter lexer uses, but it is forbidden in a tag value, as are the operators.
*/
const FORBIDDEN_TAG_CHARACTER = /[\t\n\v\f\r !&()*|]/;

/*
The words the tag filter reads as operators, which are rejected in any casing. Node compares the
lowercased tag, so `AND` is as reserved as `and`.
*/
const RESERVED_TAGS = new Set(['and', 'or', 'not']);

const messages = {
	[MESSAGE_ID_NOT_ARRAY]: '`tags` must be an array.',
	[MESSAGE_ID_HOLE]: '`tags` must not contain empty slots.',
	[MESSAGE_ID_NOT_STRING]: 'Tag values must be strings.',
	[MESSAGE_ID_EMPTY]: 'Tag values must not be empty.',
	[MESSAGE_ID_LOWERCASE]: 'Tag `{{tag}}` must use its lowercase canonical form.',
	[MESSAGE_ID_FORBIDDEN]: 'Tag `{{tag}}` must not contain whitespace or any of `&`, `|`, `!`, `(`, `)`, `*`.',
	[MESSAGE_ID_RESERVED]: 'Tag `{{tag}}` must not be the reserved word `and`, `or`, or `not`.',
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

/**
The problems for one entry of a `tags` array, in the order `node:test` itself rejects them: a hole,
a spread that proves nothing, a non-string, an empty tag, a tag with a forbidden character, a
reserved word, and only then the canonical-form and duplicate checks, which are about the tag list
rather than the tag itself.
*/
function * getElementProblems(rawElement, tags, seenTags) {
	if (rawElement === null) {
		yield {
			node: tags,
			messageId: MESSAGE_ID_HOLE,
		};
		return;
	}

	if (rawElement.type === 'SpreadElement') {
		return;
	}

	const tag = getStaticString(rawElement);
	if (!tag) {
		if (isStaticValue(rawElement)) {
			yield {
				node: rawElement,
				messageId: MESSAGE_ID_NOT_STRING,
			};
		}

		return;
	}

	if (tag.value === '') {
		yield {
			node: tag.node,
			messageId: MESSAGE_ID_EMPTY,
		};
		return;
	}

	const normalizedTag = tag.value.toLowerCase();

	if (FORBIDDEN_TAG_CHARACTER.test(tag.value)) {
		yield {
			node: tag.node,
			messageId: MESSAGE_ID_FORBIDDEN,
			data: {tag: tag.value},
		};
		return;
	}

	if (RESERVED_TAGS.has(normalizedTag)) {
		// Reported on its own: lowercasing `AND` would only produce the reserved word `and`.
		yield {
			node: tag.node,
			messageId: MESSAGE_ID_RESERVED,
			data: {tag: tag.value},
		};
		return;
	}

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
		return;
	}

	seenTags.add(normalizedTag);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// A subtest (`t.test(…)`) accepts `tags` just like an imported test.
	const tracker = createContextTracker(imports);

	context.on('CallExpression', function * (node) {
		const isSubtest = tracker.isSubtestCall(node);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		if (
			(!isSubtest && parsed?.kind !== 'test' && parsed?.kind !== 'suite')
			|| parsed?.modifiers.length > 1
			|| parsed?.modifiers.some(modifier => !TEST_AND_SUITE_MODIFIERS.has(modifier.name))
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
			yield * getElementProblems(rawElement, tags, seenTags);
		}
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
