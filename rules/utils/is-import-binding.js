import {findVariable} from '@eslint-community/eslint-utils';

/**
Whether an identifier resolves to an `import` binding, so a local variable or parameter that shadows the import does not count.

Only `context.sourceCode` is read, so the object from `resolveImports` can be passed as well.

@param {import('estree').Identifier} identifier
@param {import('eslint').Rule.RuleContext} context
@returns {boolean}
*/
export default function isImportBinding(identifier, context) {
	// `getScope` already answers the innermost scope, and passing the node itself would make `findVariable` search every child scope for it again, which is what makes a large file slow.
	const variable = findVariable(context.sourceCode.getScope(identifier), identifier.name);
	return variable?.defs.some(definition => definition.type === 'ImportBinding') ?? false;
}
