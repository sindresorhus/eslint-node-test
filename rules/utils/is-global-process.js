import {unwrapExpression} from './skip-expression-wrappers.js';

/*
Whether a node is the global `process` object reached through `globalThis.process` or
`global.process`. These are the same object as the bare `process` global, so the rules that
report on `process.…` must treat them the same way. Only the shape is checked here; each rule
decides separately whether its own `process` binding is shadowed.
*/
export default function isGlobalProcessMember(node) {
	return Boolean(getGlobalProcessObject(node));
}

/**
The `globalThis` / `global` identifier a node reaches `process` through, or `undefined` when it is
not that shape. A local `globalThis` or `global` is some other object, so a rule that targets the
global `process` has to check the identifier it gets back, the way it checks its own `process` binding.
*/
export function getGlobalProcessObject(node) {
	node = unwrapExpression(node);
	if (
		node?.type !== 'MemberExpression'
		|| node.computed
		|| node.property.type !== 'Identifier'
		|| node.property.name !== 'process'
	) {
		return;
	}

	// The receiver is unwrapped too, so a cast or a non-null assertion reads the same as the bare form.
	const object = unwrapExpression(node.object);
	return object?.type === 'Identifier' && (object.name === 'globalThis' || object.name === 'global')
		? object
		: undefined;
}
