import isMemberExpression from '../ast/is-member-expression.js';
import {unwrapExpression} from './skip-expression-wrappers.js';
import isUnshadowedGlobal from './is-unshadowed-global.js';

/**
Whether a node is `globalThis.<name>` or `global.<name>` on the real global object. That is the same object as the bare `<name>` global (`process`, `console`), so the rules that report on the bare global must treat it the same way. A local `globalThis` or `global` is some other object, exactly as a local `<name>` is. Only the member and its `globalThis` / `global` receiver are checked here; each rule decides separately whether its own bare `<name>` binding is shadowed.

@param {import('estree').Node | undefined} node
@param {string} name
@param {import('eslint').Rule.RuleContext} context
@returns {boolean}
*/
export default function isGlobalThisMember(node, name, context) {
	node = unwrapExpression(node);
	if (!isMemberExpression(node, name)) {
		return false;
	}

	// The receiver is unwrapped too, so a cast or a non-null assertion reads the same as the bare form.
	const object = unwrapExpression(node.object);
	return isUnshadowedGlobal(object, 'globalThis', context) || isUnshadowedGlobal(object, 'global', context);
}
