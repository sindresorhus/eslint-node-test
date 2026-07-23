import {
	MODIFIERS,
	resolveImports,
	parseTestCall,
	getHookCallback,
	getTestCallback,
	isHookMemberTestCall,
	isContextHookCall,
	createContextTracker,
} from './utils/node-test.js';
import {isPromiseType, getEnclosingFunction} from './utils/index.js';

const MESSAGE_ID = 'no-test-return-statement';

const messages = {
	[MESSAGE_ID]: 'Do not return a concrete value from a test or hook. Return a Promise to signal async completion, or return nothing.',
};

// "Nothing" types and types we cannot pin down, all fine to return.
const ALLOWED_TYPE_STRINGS = new Set(['void', 'undefined', 'null', 'any', 'never', 'unknown']);

/*
Whether the type is safe to return from a test or hook: a returned Promise (awaited by `node:test`),
a "nothing" type, or a type we cannot resolve. Anything else is a concrete value.
*/
function isAllowedReturnType(type, checker) {
	if (type.isUnion()) {
		return type.types.every(member => isAllowedReturnType(member, checker));
	}

	// `isPromiseType` returns `undefined` when indeterminate; only a definite `false` is a value.
	if (isPromiseType(type, checker) !== false) {
		return true;
	}

	return ALLOWED_TYPE_STRINGS.has(checker.typeToString(type));
}

function isDisallowedReturnValue(node, parserServices, checker) {
	let type;
	try {
		type = parserServices.getTypeAtLocation(node);
	} catch {
		return false;
	}

	return !isAllowedReturnType(type, checker);
}

// The test/hook callback whose return value this rule checks, or `undefined` for an unrelated call.
// Subtest (`t.test(…)`) and context-hook (`t.beforeEach(…)`) forms are resolved against the tracker,
// so query it before `update` pushes this call's own context.
function getCheckedCallback(callExpression, imports, tracker) {
	const parsed = parseTestCall(callExpression, imports);
	if (isHookMemberTestCall(parsed)) {
		return getHookCallback(callExpression);
	}

	if (parsed?.kind === 'test') {
		if (parsed.modifiers.some(modifier => !MODIFIERS.has(modifier.name))) {
			return undefined;
		}

		return getTestCallback(callExpression);
	}

	if (parsed?.kind === 'hook' && parsed.modifiers.length === 0) {
		return getHookCallback(callExpression);
	}

	if (tracker.isSubtestCall(callExpression)) {
		return getTestCallback(callExpression);
	}

	if (isContextHookCall(callExpression, tracker.isContextIdentifier)) {
		return getHookCallback(callExpression);
	}

	return undefined;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// This rule relies on type information to tell a Promise from a plain value. Without it
	// (plain JavaScript, or TypeScript linted without a program), do nothing.
	const {parserServices} = context.sourceCode;
	if (!parserServices?.program) {
		return;
	}

	const checker = parserServices.program.getTypeChecker();
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		// Resolve the callback against the enclosing contexts before `update` pushes this call's own.
		const callback = getCheckedCallback(node, imports, tracker);
		tracker.update(node);

		if (
			callback?.type === 'ArrowFunctionExpression'
			&& callback.body.type !== 'BlockStatement'
			&& !callback.async
			&& isDisallowedReturnValue(callback.body, parserServices, checker)
		) {
			return {
				node: callback.body,
				messageId: MESSAGE_ID,
			};
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});

	context.on('ReturnStatement', node => {
		if (!node.argument) {
			return;
		}

		// The return must belong to the test/hook callback itself, not a nested helper function.
		const enclosing = getEnclosingFunction(node);
		if (!enclosing || !tracker.isTrackedCallback(enclosing)) {
			return;
		}

		// An `async` function always wraps its return value in a Promise, which `node:test`
		// awaits, so returning a plain value there is fine.
		if (enclosing.async) {
			return;
		}

		if (!isDisallowedReturnValue(node.argument, parserServices, checker)) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow returning a concrete non-Promise value from a test or hook.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
