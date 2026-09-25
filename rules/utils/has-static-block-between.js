/**
Whether a class static block sits between `node` and the `boundary` that encloses it.

A static block is a statement list the runner executes on its own, not a function, so an `await` or a
`return` written in one does not belong to the callback that encloses the class.

@param {import('estree').Node} node
@param {import('estree').Node | undefined} boundary
@returns {boolean}
*/
export default function hasStaticBlockBetween(node, boundary) {
	for (let current = node; current && current !== boundary; current = current.parent) {
		if (current.type === 'StaticBlock') {
			return true;
		}
	}

	return false;
}
