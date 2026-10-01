// A statement starting with `(` or `[` continues the expression above it, so a rewrite that makes it start that way has to separate them.
const STARTS_WITH_BRACKET = /^[([]/;

// A token that already ends whatever is above the statement, so a rewrite starting with a bracket needs no leading `;` after it.
const SEPARATING_TOKENS = new Set([';', '{']);

// Only a statement in a statement list follows another statement. The body of a braceless `if`, `else` or loop follows its head, and a `;` there would become the whole body.
const STATEMENT_LIST_TYPES = new Set(['Program', 'BlockStatement', 'StaticBlock', 'SwitchCase', 'TSModuleBlock']);

/**
Whether replacing `node`, which belongs to `statement`, with `text` needs a leading `;` to keep the statement from joining the one above it.

Only a replacement at the start of the statement can join the line above. A token inside the statement before `node` (`<any>` or a `(` around it) keeps the two apart, so only a token before the statement counts.
*/
export default function needsLeadingSemicolon(node, statement, text, context) {
	if (!STARTS_WITH_BRACKET.test(text) || !STATEMENT_LIST_TYPES.has(statement.parent?.type)) {
		return false;
	}

	const {sourceCode} = context;
	const tokenBefore = sourceCode.getTokenBefore(node);
	return tokenBefore !== null
		&& sourceCode.getRange(tokenBefore)[1] <= sourceCode.getRange(statement)[0]
		&& !SEPARATING_TOKENS.has(tokenBefore.value);
}
