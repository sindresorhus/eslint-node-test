/*
Whether `child` sits in a conditionally-executed branch of its parent `ancestor`, as opposed to the
always-evaluated condition/test. Covers `if`/ternary (consequent or alternate), logical `&&`/`||`/`??`
(the short-circuited right side), and `switch` (a case body). Pass `includeLoops` to also treat a
loop body as conditional, since it may run zero times.
*/
export default function isConditionalBranch(ancestor, child, {includeLoops = false} = {}) {
	switch (ancestor.type) {
		case 'IfStatement':
		case 'ConditionalExpression': {
			// Only the consequent/alternate are conditional; the test always runs.
			return child !== ancestor.test;
		}

		case 'LogicalExpression': {
			// Only the right-hand side is conditional (it may be short-circuited).
			return child === ancestor.right;
		}

		case 'SwitchCase': {
			// The case body is conditional; the case's test expression is not.
			return ancestor.consequent.includes(child);
		}

		case 'WhileStatement':
		case 'DoWhileStatement':
		case 'ForStatement':
		case 'ForInStatement':
		case 'ForOfStatement': {
			return includeLoops && child === ancestor.body;
		}

		default: {
			return false;
		}
	}
}
