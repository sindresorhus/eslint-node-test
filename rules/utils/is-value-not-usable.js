import {isExpressionStatement} from '../ast/index.js';

export default function isValueNotUsable(node) {
	return isExpressionStatement(node.parent);
}
