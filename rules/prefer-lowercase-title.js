import {resolveImports, parseTestCall, getTestTitle} from './utils/node-test.js';

const MESSAGE_ID = 'prefer-lowercase-title';

const messages = {
	[MESSAGE_ID]: 'Start the title with a lowercase letter.',
};

/** Get the static text at the start of a title node, or `undefined` if there is none. */
const getLeadingText = node => {
	if (node.type === 'Literal' && typeof node.value === 'string') {
		return node.value;
	}

	// `` `text ${x}` `` — the text before the first expression. Empty if it starts with `${…}`.
	if (node.type === 'TemplateLiteral') {
		return node.quasis[0].value.cooked || undefined;
	}

	return undefined;
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const {ignore, allowedPrefixes} = context.options[0];

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (parsed?.kind !== 'test' && parsed?.kind !== 'suite') {
			return;
		}

		if (ignore.includes(parsed.name)) {
			return;
		}

		const titleNode = getTestTitle(node, context);
		if (!titleNode) {
			return;
		}

		const leadingText = getLeadingText(titleNode);
		if (!leadingText) {
			return;
		}

		if (allowedPrefixes.some(prefix => leadingText.startsWith(prefix))) {
			return;
		}

		const firstCharacter = leadingText[0];
		if (!/\p{Uppercase_Letter}/u.test(firstCharacter)) {
			return;
		}

		const problem = {
			node: titleNode,
			messageId: MESSAGE_ID,
		};

		// The first content character sits right after the opening quote/backtick.
		const start = sourceCode.getRange(titleNode)[0] + 1;
		// Skip the fix when the first character is written as a Unicode/hex escape, so the
		// raw source does not start with the letter itself and replacing it would corrupt the escape.
		if (sourceCode.getText(titleNode)[1] === firstCharacter) {
			problem.fix = fixer => fixer.replaceTextRange([start, start + 1], firstCharacter.toLowerCase());
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
			description: 'Enforce lowercase test titles.',
			recommended: false,
		},
		fixable: 'code',
		schema: [
			{
				type: 'object',
				properties: {
					ignore: {
						type: 'array',
						items: {
							enum: ['test', 'it', 'describe', 'suite'],
						},
						uniqueItems: true,
						description: 'Test functions whose titles are not checked.',
					},
					allowedPrefixes: {
						type: 'array',
						items: {
							type: 'string',
						},
						uniqueItems: true,
						description: 'Title prefixes that are allowed to start with an uppercase letter.',
					},
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{ignore: [], allowedPrefixes: []}],
		messages,
		languages: ['js/js'],
	},
};

export default config;
