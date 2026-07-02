export function isLiteral(node, value) {
	if (node?.type !== 'Literal') {
		return false;
	}

	return node.value === value;
}

const isStringLiteral = node => node?.type === 'Literal' && typeof node.value === 'string';

// A node whose value is always a string: a string literal or any template literal.
export const isStringExpression = node => isStringLiteral(node) || node?.type === 'TemplateLiteral';

export const isBooleanLiteral = (node, value) =>
	node?.type === 'Literal'
	&& typeof node.value === 'boolean'
	&& (value === undefined || node.value === value);

export const getStaticStringValue = node => {
	if (isStringLiteral(node)) {
		return node.value;
	}

	if (
		node?.type === 'TemplateLiteral'
		&& node.expressions.length === 0
	) {
		return node.quasis[0].value.cooked;
	}
};

export const isRegexLiteral = node => node.type === 'Literal' && Boolean(node.regex);
