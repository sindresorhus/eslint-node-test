import {findVariable} from '@eslint-community/eslint-utils';

/**
Whether `node` is an identifier that resolves to the unshadowed global of the same name, i.e. one
with no definitions at all. A local declaration or parameter of that name is a different binding, so
a rule that targets a global must not match it.

@param {import('eslint').Rule.RuleContext} context
@param {import('estree').Node | undefined} node
@returns {boolean}
*/
export default function isUnshadowedGlobal(context, node) {
	if (node?.type !== 'Identifier') {
		return false;
	}

	const variable = findVariable(context.sourceCode.getScope(node), node);
	return !variable || variable.defs.length === 0;
}
