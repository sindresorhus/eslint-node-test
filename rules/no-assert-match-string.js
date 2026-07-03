import {
	resolveImports,
	parseAssertionCall,
	createContextTracker,
	isAssertionCallWithSupportedContext,
} from './utils/node-test.js';
import {isStringExpression, getStaticStringValue} from './ast/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID_ERROR = 'no-assert-match-string/error';
const MESSAGE_ID_REGEXP_SUGGESTION = 'no-assert-match-string/regexp-suggestion';
const MESSAGE_ID_ASSERTION_SUGGESTION = 'no-assert-match-string/assertion-suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: 'The second argument to `{{method}}()` must be a `RegExp`, not a string.',
	[MESSAGE_ID_REGEXP_SUGGESTION]: 'Wrap the string in `new RegExp()`.',
	[MESSAGE_ID_ASSERTION_SUGGESTION]: 'Compare with `{{replacementMethod}}()`.',
};

const MATCH_METHODS = new Set(['match', 'doesNotMatch']);
const EQUALITY_METHODS = new Map([
	['match', 'strictEqual'],
	['doesNotMatch', 'notStrictEqual'],
]);

function canConvertToRegExp(node) {
	const value = getStaticStringValue(unwrapTypeScriptExpression(node));
	if (value === undefined) {
		return false;
	}

	try {
		const regexp = new RegExp(value);
		return regexp instanceof RegExp;
	} catch {
		return false;
	}
}

function getSuggestions({node, parsed, regexpArgument, sourceCode}) {
	const suggestions = [];

	if (canConvertToRegExp(regexpArgument)) {
		suggestions.push({
			messageId: MESSAGE_ID_REGEXP_SUGGESTION,
			fix: fixer => fixer.replaceText(regexpArgument, `new RegExp(${sourceCode.getText(regexpArgument)})`),
		});
	}

	const replacementMethod = EQUALITY_METHODS.get(parsed.method);
	if (
		replacementMethod
		&& parsed.methodNode
		&& node.callee.type !== 'Identifier'
	) {
		const methodReplacementRange = getMethodReplacementRange(node, parsed, sourceCode);
		if (methodReplacementRange) {
			suggestions.push({
				messageId: MESSAGE_ID_ASSERTION_SUGGESTION,
				data: {replacementMethod},
				fix: fixer => fixer.replaceTextRange(methodReplacementRange, replacementMethod),
			});
		}
	}

	return suggestions;
}

function getMethodReplacementRange(node, parsed, sourceCode) {
	const {callee} = node;
	if (
		callee.type === 'MemberExpression'
		&& callee.object.type === 'MemberExpression'
		&& !callee.object.computed
		&& callee.object.property.type === 'Identifier'
		&& callee.object.property.name === 'strict'
	) {
		const range = [
			sourceCode.getRange(callee.object.property)[0],
			sourceCode.getRange(parsed.methodNode)[1],
		];
		if (hasCommentInRange(sourceCode, callee, range)) {
			return undefined;
		}

		return range;
	}

	return sourceCode.getRange(parsed.methodNode);
}

function hasCommentInRange(sourceCode, node, range) {
	return sourceCode.getCommentsInside(node).some(comment => {
		const commentRange = sourceCode.getRange(comment);
		return commentRange[0] >= range[0] && commentRange[1] <= range[1];
	});
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const parsed = parseAssertionCall(node, imports);
		if (!parsed || !MATCH_METHODS.has(parsed.method) || !isAssertionCallWithSupportedContext(node, tracker)) {
			return;
		}

		const regexpArgument = node.arguments[1];
		if (
			!regexpArgument
			|| regexpArgument.type === 'SpreadElement'
			|| !isStringExpression(unwrapTypeScriptExpression(regexpArgument))
		) {
			return;
		}

		const problem = {
			node: regexpArgument,
			messageId: MESSAGE_ID_ERROR,
			data: {method: parsed.method},
		};

		const suggestions = getSuggestions({
			node,
			parsed,
			regexpArgument,
			sourceCode,
		});
		if (suggestions.length > 0) {
			problem.suggest = suggestions;
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
		type: 'problem',
		docs: {
			description: 'Disallow strings as the regexp argument of `assert.match()`/`assert.doesNotMatch()`.',
			recommended: 'unopinionated',
		},
		hasSuggestions: true,
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
