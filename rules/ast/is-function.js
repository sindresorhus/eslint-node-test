import functionTypes from './function-types.js';

export default function isFunction(node) {
	// A missing argument is not a function, and several callers ask about an optional node.
	return functionTypes.includes(node?.type);
}
