import {findVariable} from '@eslint-community/eslint-utils';

/**
Whether `node` is an identifier named `name` that resolves to the unshadowed global of that name, i.e. one with no definitions at all. A local declaration or parameter of that name is a different binding, so a rule that targets a global must not match it.

@param {import('estree').Node | undefined} node
@param {string} name
@param {import('eslint').Rule.RuleContext} context
@returns {boolean}
*/
export default function isUnshadowedGlobal(node, name, context) {
	if (node?.type !== 'Identifier' || node.name !== name) {
		return false;
	}

	const variable = findVariable(context.sourceCode.getScope(node), node);
	return !variable || variable.defs.length === 0;
}
