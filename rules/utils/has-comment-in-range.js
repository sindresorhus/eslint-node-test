/**
Whether a comment inside `node` lies fully within `range`. Use it before a fix removes or replaces that range, so the fix does not drop the comment.

@param {import('estree').Node} node
@param {[number, number]} range
@param {import('eslint').Rule.RuleContext} context
@returns {boolean}
*/
export default function hasCommentInRange(node, range, context) {
	const {sourceCode} = context;
	return sourceCode.getCommentsInside(node).some(comment => {
		const commentRange = sourceCode.getRange(comment);
		return commentRange[0] >= range[0] && commentRange[1] <= range[1];
	});
}
