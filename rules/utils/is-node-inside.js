/**
Whether `node` is `container` itself or sits anywhere inside it.

@param {import('estree').Node} node
@param {import('estree').Node} container
@returns {boolean}
*/
export default function isNodeInside(node, container) {
	for (let current = node; current; current = current.parent) {
		if (current === container) {
			return true;
		}
	}

	return false;
}
