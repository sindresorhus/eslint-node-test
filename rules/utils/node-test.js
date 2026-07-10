import {findVariable, getStaticValue} from '@eslint-community/eslint-utils';
import isFunction from '../ast/is-function.js';
import unwrapTypeScriptExpression from './unwrap-typescript-expression.js';

/*
Detection helpers for Node.js's built-in test runner (`node:test`).

Unlike AVA, `node:test` is import-based. Rules first resolve the local names that
the file imported from `node:test` / `node:assert`, then match calls against them.

```js
import test, {describe, it, before} from 'node:test';
import assert from 'node:assert/strict';
import {strictEqual} from 'node:assert';
```
*/

/** Canonical test/suite/hook function names exported from `node:test`. */
const TEST_FUNCTIONS = new Set(['test', 'it']);
const SUITE_FUNCTIONS = new Set(['describe', 'suite']);
const HOOK_FUNCTIONS = new Set(['before', 'after', 'beforeEach', 'afterEach']);
const ALL_TEST_EXPORTS = new Set([...TEST_FUNCTIONS, ...SUITE_FUNCTIONS, ...HOOK_FUNCTIONS, 'mock']);
const CONFIGURATION_EXPORTS = new Set(['assert', 'snapshot']);

export {TEST_FUNCTIONS, SUITE_FUNCTIONS, HOOK_FUNCTIONS};

/** Modifier names usable as `test.only()`, `test.skip()`, `test.todo()`. */
const MODIFIERS = new Set(['only', 'skip', 'todo']);
export {MODIFIERS};

const TEST_MODULES = new Set(['node:test', 'test']);
const ASSERT_MODULES = new Set(['node:assert', 'node:assert/strict', 'assert', 'assert/strict']);

/**
Scan a file's top-level imports and resolve the local bindings for
`node:test` and `node:assert`.

@returns {{
	locals: Map<string, string>,
	namespace: string | undefined,
	configurationLocals: Map<string, string>,
	assertNamespace: Set<string>,
	assertNamed: Map<string, string>,
	strictAssertLocals: Set<string>,
	mockLocals: Set<string>,
	sourceCode: import('eslint').SourceCode,
	isTestFile: boolean,
	hasAssert: boolean,
	isAssertOrTestFile: boolean,
}}
*/
// Cache the result per AST so the many rules sharing this helper only scan the file once.
const importsCache = new WeakMap();

export function resolveImports(context) {
	const {ast} = context.sourceCode;
	const cached = importsCache.get(ast);
	if (cached) {
		return cached;
	}

	const result = scanImports(context);
	importsCache.set(ast, result);
	return result;
}

/** Classify an import source as the test module, the assert module, or neither. */
function moduleKind(source) {
	if (TEST_MODULES.has(source)) {
		return 'test';
	}

	if (ASSERT_MODULES.has(source)) {
		return 'assert';
	}

	return undefined;
}

/**
Record an assert binding. A named import passes the canonical `importedName`; a whole-module
binding (`import assert from …`, `import * as assert …`) passes `undefined`. Strict-mode sources
also mark the local as already-strict.
*/
function addAssertBinding(bindings, localName, importedName, isStrict) {
	if (importedName === undefined) {
		bindings.assertNamespace.add(localName);
	} else {
		bindings.assertNamed.set(localName, importedName);
	}

	if (isStrict) {
		bindings.strictAssertLocals.add(localName);
	}
}

function getImportSpecifierName(specifier) {
	if (specifier.imported.type === 'Identifier') {
		return specifier.imported.name;
	}

	return typeof specifier.imported.value === 'string' ? specifier.imported.value : undefined;
}

/** Collect bindings from an ESM `import` declaration. */
function collectFromImport(node, bindings) {
	const {value: source} = node.source;
	const kind = moduleKind(source);
	if (!kind) {
		return;
	}

	const isStrict = source.endsWith('/strict');

	for (const specifier of node.specifiers) {
		const localName = specifier.local.name;

		// Named import: `import {describe} from 'node:test'` / `import {strictEqual} from 'node:assert'`.
		if (specifier.type === 'ImportSpecifier') {
			const importedName = getImportSpecifierName(specifier);
			if (!importedName) {
				continue;
			}

			if (kind === 'assert') {
				if (importedName === 'strict') {
					addAssertBinding(bindings, localName, undefined, true);
				} else if (importedName === 'default') {
					addAssertBinding(bindings, localName, undefined, isStrict);
				} else {
					addAssertBinding(bindings, localName, importedName, isStrict);
				}

				continue;
			}

			if (importedName === 'default') {
				bindings.locals.set(localName, 'test');
				bindings.namespace = localName;
			} else if (ALL_TEST_EXPORTS.has(importedName)) {
				bindings.locals.set(localName, importedName);
			} else if (CONFIGURATION_EXPORTS.has(importedName)) {
				bindings.configurationLocals.set(localName, importedName);
			}
		} else if (kind === 'assert') {
			// Default or namespace import of the whole assert module.
			addAssertBinding(bindings, localName, undefined, isStrict);
		} else if (specifier.type === 'ImportDefaultSpecifier') {
			// `import test from 'node:test'` -> the default export is the callable `test` function, which
			// also exposes the named exports as properties. Bind it as both the `test` local (bare
			// `test(…)`, `test.only(…)`) and a namespace (`test.describe(…)`).
			bindings.locals.set(localName, 'test');
			bindings.namespace = localName;
		} else {
			// `import * as nodeTest from 'node:test'`.
			bindings.namespace = localName;
		}
	}
}

function scanImports(context) {
	const bindings = {
		sourceCode: context.sourceCode,
		// Map of local identifier name -> canonical `node:test` export name.
		locals: new Map(),
		// `import * as nodeTest from 'node:test'` -> namespace local name.
		namespace: undefined,
		// Map of local identifier name -> process-wide `node:test` configuration object.
		configurationLocals: new Map(),
		// Local names bound to the whole `node:assert` module (`import assert from …`).
		assertNamespace: new Set(),
		// Map of local name -> canonical `node:assert` method name (named imports).
		assertNamed: new Map(),
		// Local names bound to a strict-mode assert module (`node:assert/strict`), where
		// the legacy methods (`equal`/`deepEqual`/…) already behave as their strict counterparts.
		strictAssertLocals: new Set(),
	};

	for (const node of context.sourceCode.ast.body) {
		if (node.type === 'ImportDeclaration' && typeof node.source.value === 'string') {
			collectFromImport(node, bindings);
		}
	}

	const {locals, namespace, assertNamespace, assertNamed} = bindings;
	// The file imports test/suite/hook bindings from `node:test`.
	const isTestFile = locals.size > 0 || namespace !== undefined;
	// The file imports anything from `node:assert`.
	const hasAssert = assertNamespace.size > 0 || assertNamed.size > 0;
	return {
		...bindings,
		sourceCode: context.sourceCode,
		// Local names bound to the `mock` export (`import {mock} from 'node:test'`, renamed too).
		mockLocals: new Set([...locals].filter(([, canonical]) => canonical === 'mock').map(([local]) => local)),
		isTestFile,
		hasAssert,
		// Assertion rules activate on either: a `node:assert` import, or a test file (where `t.assert.*`
		// works without importing `node:assert`).
		isAssertOrTestFile: hasAssert || isTestFile,
	};
}

function getVariable(identifier, imports) {
	return findVariable(imports.sourceCode.getScope(identifier), identifier);
}

function getDeclaredVariable(identifier, node, imports) {
	return imports.sourceCode.getDeclaredVariables(node).find(variable => variable.identifiers.includes(identifier));
}

function isImportedBindingReference(identifier, imports) {
	return getVariable(identifier, imports)?.defs.some(definition => definition.type === 'ImportBinding') ?? false;
}

/** Whether a node references the global `mock` — a named/renamed import, `namespace.mock`, or `test.mock`/`it.mock`. */
export function isGlobalMock(node, imports) {
	return (
		(
			node.type === 'Identifier'
			&& imports.mockLocals.has(node.name)
			&& isImportedBindingReference(node, imports)
		)
		|| (
			node.type === 'MemberExpression'
			&& !node.computed
			&& node.property.type === 'Identifier'
			&& node.property.name === 'mock'
			&& node.object.type === 'Identifier'
			&& (
				node.object.name === imports.namespace
				|| TEST_FUNCTIONS.has(imports.locals.get(node.object.name))
			)
			&& isImportedBindingReference(node.object, imports)
		)
	);
}

function computeCalleeChain(node) {
	const members = [];

	while (node) {
		node = unwrapTypeScriptExpression(node);

		if (node.type === 'ChainExpression') {
			node = node.expression;
			continue;
		}

		if (node.type === 'Identifier') {
			return {root: node, members};
		}

		if (
			node.type === 'MemberExpression'
			&& !node.computed
			&& node.property.type === 'Identifier'
		) {
			members.unshift(node.property);
			node = node.object;
			continue;
		}

		return undefined;
	}

	return undefined;
}

/*
Cache the chain per callee node. It is a pure function of the node, and both `parseTestCall` and `getSubtestReceiver` (used by ~30 rules) walk the same callee on every `CallExpression`, so the first walk is reused across all of them. The returned object is shared, so callers must treat it (and its `members` array) as read-only.
*/
const calleeChainCache = new WeakMap();

// Sentinel stored for callees with no chain, so a cache hit is a single `get` even when the
// computed result is `undefined` (the common case for non-matching callees).
const NO_CHAIN = Symbol('no chain');

/**
Walk a callee chain into its root identifier and the member property nodes after it.

Unwraps TypeScript wrappers and optional chaining while walking.

@returns {{root: import('estree').Identifier, members: import('estree').Identifier[]} | undefined}
*/
export function getCalleeChain(node) {
	if (!node) {
		return undefined;
	}

	const cached = calleeChainCache.get(node);
	if (cached !== undefined) {
		return cached === NO_CHAIN ? undefined : cached;
	}

	const result = computeCalleeChain(node);
	calleeChainCache.set(node, result ?? NO_CHAIN);
	return result;
}

/** Classify a canonical export name as a test, suite, or hook (or `undefined`). */
function getCallKind(name) {
	if (TEST_FUNCTIONS.has(name)) {
		return 'test';
	}

	if (SUITE_FUNCTIONS.has(name)) {
		return 'suite';
	}

	if (HOOK_FUNCTIONS.has(name)) {
		return 'hook';
	}

	return undefined;
}

/*
Memoize the `parse*Call` classifiers by node. The same `CallExpression` is parsed by many rules during one lint run (34 rules call `parseTestCall`, 21 call `parseAssertionCall`), and `imports` is stable per file (it is itself cached per AST), so the first parse can be reused across all of them. Keyed by node with an `imports` guard for safety.

The cached result object is shared between callers, so treat it as read-only — never mutate the returned `modifiers` array or reassign its fields.
*/
const parseTestCallCache = new WeakMap();
const parseAssertionCallCache = new WeakMap();

const memoizeByNode = (cache, compute) => (callExpression, imports) => {
	if (callExpression.type !== 'CallExpression') {
		return undefined;
	}

	const cached = cache.get(callExpression);
	if (cached && cached.imports === imports) {
		return cached.result;
	}

	const result = compute(callExpression, imports);
	cache.set(callExpression, {imports, result});
	return result;
};

/**
Classify a `CallExpression` as a `node:test` test/suite/hook call.

@returns {{
	name: string,
	kind: 'test' | 'suite' | 'hook',
	modifiers: import('estree').Identifier[],
} | undefined}
*/
export const parseTestCall = memoizeByNode(parseTestCallCache, (callExpression, imports) => {
	const chain = getCalleeChain(callExpression.callee);
	if (!chain) {
		return undefined;
	}

	const {root, members} = chain;
	if (!isImportedBindingReference(root, imports)) {
		return undefined;
	}

	let name;
	let modifiers;

	if (
		members.length > 0
		&& ALL_TEST_EXPORTS.has(members[0].name)
		&& (
			root.name === imports.namespace
			|| TEST_FUNCTIONS.has(imports.locals.get(root.name))
		)
	) {
		// `nodeTest.test.only(…)` — namespace member access into a known export.
		const [first, ...rest] = members;
		name = first.name;
		modifiers = rest;
	} else if (imports.locals.has(root.name)) {
		// `test.only(…)` / bare `test(…)` — a callable test binding. A binding that is both a local and
		// the namespace (`import test from 'node:test'`) reaches here for member chains whose first
		// segment is not a known export, e.g. `test.only(…)`.
		name = imports.locals.get(root.name);
		modifiers = members;
	} else {
		return undefined;
	}

	if (modifiers.some(modifier => CONFIGURATION_EXPORTS.has(modifier.name))) {
		return undefined;
	}

	const kind = getCallKind(name);
	if (!kind) {
		return undefined;
	}

	return {name, kind, modifiers};
});

/** Get the modifier identifier node with the given name (`only`/`skip`/`todo`), or `undefined`. */
export const findModifier = (modifiers, name) => modifiers.find(modifier => modifier.name === name);

export function isHookMemberTestCall(parsed) {
	return parsed?.kind === 'test'
		&& parsed.modifiers.length === 1
		&& HOOK_FUNCTIONS.has(parsed.modifiers[0].name);
}

/**
For a subtest-shaped call (`receiver.test(…)`, optionally with chained `.only`/`.skip`/`.todo` modifiers), return the receiver identifier node. Otherwise `undefined`.
*/
export function getSubtestReceiver(callExpression) {
	if (callExpression.type !== 'CallExpression') {
		return undefined;
	}

	const chain = getCalleeChain(callExpression.callee);
	if (
		chain
		&& chain.members[0]?.name === 'test'
		&& chain.members.slice(1).every(member => MODIFIERS.has(member.name))
	) {
		return chain.root;
	}

	return undefined;
}

/**
Track the test-context parameter names (`t`) introduced by enclosing test, subtest, and optionally hook callbacks.

Subtests (`t.test(…)`) are method calls, not imported bindings, so recognizing them requires knowing the enclosing context name. Drive the tracker from a `CallExpression` visitor: query `isSubtestCall`/`isContextName` first (against the current stack), then call `update(node)` to push this call's own context, and `leave(node)` on exit.

Set `trackHooks` to also track hook context parameters for rules that inspect `t.assert.*()`.

@returns {{
	isSubtestCall: (node: import('estree').Node) => boolean,
	isContextIdentifier: (node: import('estree').Node | undefined) => boolean,
	isContextName: (name: string | undefined) => boolean,
	current: () => string | undefined,
	currentCallback: () => import('estree').Node | undefined,
	update: (node: import('estree').Node) => void,
	leave: (node: import('estree').Node) => void,
}}
*/
export function createContextTracker(imports, {trackHooks = false} = {}) {
	const names = [];
	const variables = [];
	const callbacks = [];
	const pushedCalls = new Set();

	const isContextIdentifier = node => {
		if (node?.type !== 'Identifier') {
			return false;
		}

		const variable = getVariable(node, imports);
		return variable !== undefined && variables.includes(variable);
	};

	const isSubtestCall = node => {
		const receiver = getSubtestReceiver(node);
		return isContextIdentifier(receiver);
	};

	const isTrackedHookCall = parsed => trackHooks && (
		(
			parsed?.kind === 'hook'
			&& parsed.modifiers.length === 0
		)
		|| isHookMemberTestCall(parsed)
	);

	const isTrackedCallbackCall = node => {
		const parsed = parseTestCall(node, imports);
		return (
			(
				parsed?.kind === 'test'
				&& parsed.modifiers.every(modifier => MODIFIERS.has(modifier.name))
			)
			|| isTrackedHookCall(parsed)
		);
	};

	return {
		isSubtestCall,
		isContextIdentifier,
		isContextName: name => name !== undefined && names.includes(name),
		// The name of the innermost enclosing tracked context, or `undefined` when its
		// callback declared no context parameter (or we are not inside a tracked callback).
		current: () => names.at(-1),
		// The callback function node of the innermost enclosing tracked callback. The context parameter is
		// only in scope inside this node, so a node visited in the call's title/options arguments (which
		// the traversal reaches before the callback) is not actually within the context's scope.
		currentCallback: () => callbacks.at(-1),
		update(node) {
			if (!(isTrackedCallbackCall(node) || isSubtestCall(node))) {
				return;
			}

			const parsed = parseTestCall(node, imports);
			const callback = isTrackedHookCall(parsed) ? getHookCallback(node) : getTestCallback(node);
			if (callback) {
				const parameter = callback.params[0];

				names.push(parameter?.type === 'Identifier' ? parameter.name : undefined);
				variables.push(parameter?.type === 'Identifier' ? getDeclaredVariable(parameter, callback, imports) : undefined);
				callbacks.push(callback);
				pushedCalls.add(node);
			}
		},
		leave(node) {
			if (!pushedCalls.has(node)) {
				return;
			}

			pushedCalls.delete(node);
			names.pop();
			variables.pop();
			callbacks.pop();
		},
	};
}

function getContextAssertIdentifier(node) {
	const {callee} = node;
	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.object.type === 'MemberExpression'
		&& !callee.object.computed
		&& callee.object.object.type === 'Identifier'
		&& callee.object.property.type === 'Identifier'
		&& callee.object.property.name === 'assert'
	) {
		return callee.object.object;
	}

	return undefined;
}

/**
Check whether a `t.assert.*()` call belongs to a tracked test context.
*/
export function isAssertionCallWithSupportedContext(node, tracker) {
	const contextAssertIdentifier = getContextAssertIdentifier(node);
	return contextAssertIdentifier === undefined || tracker.isContextIdentifier(contextAssertIdentifier);
}

/**
Track the nesting depth of enclosing `describe`/`suite` blocks across a `CallExpression` visitor.

`depth` reflects the suites currently on the stack. Call `enterSuite(node)` once a call has been classified as a suite, and `exitSuite(node)` from the matching `CallExpression:exit` listener (it ignores nodes that were never entered, so it is safe to call for every exit). Reading `depth` before `enterSuite` gives the enclosing depth; reading it after includes the just-entered suite.

@returns {{depth: number, enterSuite: (node: import('estree').Node) => void, exitSuite: (node: import('estree').Node) => void}}
*/
export function createSuiteDepthTracker() {
	const suiteCalls = new Set();
	let depth = 0;

	return {
		get depth() {
			return depth;
		},
		enterSuite(node) {
			depth += 1;
			suiteCalls.add(node);
		},
		exitSuite(node) {
			if (!suiteCalls.has(node)) {
				return;
			}

			suiteCalls.delete(node);
			depth -= 1;
		},
	};
}

/**
Get the title argument node of a test/suite call, if its first argument is a static string.
*/
export function getTestTitle(callExpression, context) {
	const {sourceCode} = context;
	const first = unwrapTypeScriptExpression(callExpression.arguments[0]);
	if (!first) {
		return undefined;
	}

	if (first.type === 'Literal' && typeof first.value === 'string') {
		return first;
	}

	if (first.type === 'TemplateLiteral') {
		return first;
	}

	const staticValue = getStaticValue(first, sourceCode.getScope(first));
	return typeof staticValue?.value === 'string' ? first : undefined;
}

/** Get the static string value of a node, if it resolves to one. */
export function getStaticString(node, context) {
	if (!node) {
		return undefined;
	}

	const {sourceCode} = context;
	node = unwrapTypeScriptExpression(node);

	if (node.type === 'Literal' && typeof node.value === 'string') {
		return node.value;
	}

	if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
		return node.quasis[0].value.cooked ?? undefined;
	}

	const staticValue = getStaticValue(node, sourceCode.getScope(node));
	return typeof staticValue?.value === 'string' ? staticValue.value : undefined;
}

/**
Get the inline function implementation argument of a hook call, if any.

`node:test` hooks take the callback as the first argument, with optional trailing options.
*/
export function getHookCallback(callExpression) {
	const firstArgument = unwrapTypeScriptExpression(callExpression.arguments[0]);
	if (firstArgument && isFunction(firstArgument)) {
		return firstArgument;
	}

	return undefined;
}

/**
Get the inline function implementation argument of a test/suite call, or a hook call where the callback is last.
*/
export function getTestCallback(callExpression) {
	for (let index = callExpression.arguments.length - 1; index >= 0; index -= 1) {
		const argument = unwrapTypeScriptExpression(callExpression.arguments[index]);
		if (isFunction(argument)) {
			return argument;
		}

		// Stop at the first non-function trailing argument (options/title).
		if (argument.type !== 'SpreadElement') {
			return undefined;
		}
	}

	return undefined;
}

/*
The number of parameters before the first default or rest parameter — the same value as `Function.prototype.length`. `node:test` uses this arity to decide whether to pass a `done` callback, so a declared second parameter means the function opted into callback style.
*/
export function getEffectiveArity(parameters) {
	let count = 0;
	for (const parameter of parameters) {
		if (parameter.type === 'AssignmentPattern' || parameter.type === 'RestElement') {
			break;
		}

		count += 1;
	}

	return count;
}

/**
Get the options `ObjectExpression` argument of a test/suite/hook call, if any.
*/
export function getTestOptions(callExpression) {
	for (const argument of callExpression.arguments) {
		const unwrapped = unwrapTypeScriptExpression(argument);
		if (unwrapped.type === 'ObjectExpression') {
			return unwrapped;
		}
	}

	return undefined;
}

/**
Find a boolean-ish property (`only`/`skip`/`todo`) in an options object.
*/
export function findOptionsProperty(optionsObject, name) {
	if (optionsObject?.type !== 'ObjectExpression') {
		return undefined;
	}

	return optionsObject.properties.find(property =>
		property.type === 'Property'
		&& !property.computed
		&& (
			(property.key.type === 'Identifier' && property.key.name === name)
			|| (property.key.type === 'Literal' && property.key.value === name)
		));
}

/**
Find an options property (`only`/`skip`/`todo`) that is set to an *enabled* value, i.e. present and not a statically-falsy value. `node:test` checks these options for truthiness, so `false`, `null`, `0`, `''`, and `undefined` all mean disabled; a truthy literal (`true`), a skip/todo reason string, or a dynamic value all count as enabled. Returns the property node, or `undefined`.
*/
export function findEnabledOptionsProperty(optionsObject, name) {
	const property = findOptionsProperty(optionsObject, name);
	const value = property && unwrapTypeScriptExpression(property.value);
	if (
		property
		&& !(value.type === 'Identifier' && value.name === 'undefined')
		&& (value.type !== 'Literal' || value.value)
	) {
		return property;
	}

	return undefined;
}

/**
Determine the kind (`test`/`suite`/`hook`) of the nearest enclosing test-related callback.

Returns `undefined` when the nearest enclosing function is a regular function (e.g. a helper), or there is none. Subtests (`t.test(…)`) are method calls rather than imported bindings, so they are recognized structurally and classified as `'test'`.
*/
export function nearestTestCallbackKind(node, imports) {
	let current = node.parent;
	while (current) {
		if (isFunction(current)) {
			const call = current.parent;
			if (call?.type === 'CallExpression') {
				const parsed = parseTestCall(call, imports);
				if (
					parsed?.kind === 'hook'
					&& parsed.modifiers.length === 0
					&& getHookCallback(call) === current
				) {
					return 'hook';
				}

				if (isHookMemberTestCall(parsed) && getHookCallback(call) === current) {
					return 'hook';
				}

				if (parsed && getTestCallback(call) === current) {
					return parsed.kind;
				}

				if (getSubtestReceiver(call) !== undefined && getTestCallback(call) === current) {
					return 'test';
				}
			}

			// Inside some other function — not directly in a test/suite/hook body.
			return undefined;
		}

		current = current.parent;
	}

	return undefined;
}

function isAssertNamespaceIdentifier(node, imports) {
	return (
		node.type === 'Identifier'
		&& imports.assertNamespace.has(node.name)
		&& isImportedBindingReference(node, imports)
	);
}

function isNamedStrictAssertIdentifier(node, imports) {
	return (
		node.type === 'Identifier'
		&& imports.assertNamed.get(node.name) === 'strict'
		&& isImportedBindingReference(node, imports)
	);
}

function isAssertStrictMember(node, imports) {
	return (
		node.type === 'MemberExpression'
		&& !node.computed
		&& isAssertNamespaceIdentifier(node.object, imports)
		&& node.property.type === 'Identifier'
		&& node.property.name === 'strict'
	);
}

function isTestContextAssertMember(node) {
	return (
		node.type === 'MemberExpression'
		&& !node.computed
		&& node.object.type === 'Identifier'
		&& node.property.type === 'Identifier'
		&& node.property.name === 'assert'
	);
}

function parseAssertionMemberCall(callee, imports) {
	if (
		callee.type !== 'MemberExpression'
		|| callee.computed
		|| callee.property.type !== 'Identifier'
	) {
		return;
	}

	const {object} = callee;

	if (callee.property.name === 'strict' && isAssertNamespaceIdentifier(object, imports)) {
		return {
			method: 'ok',
			methodNode: undefined,
			isStrict: true,
		};
	}

	// `assert.strictEqual(…)`
	if (isAssertNamespaceIdentifier(object, imports)) {
		return {
			method: callee.property.name,
			methodNode: callee.property,
			isStrict: imports.strictAssertLocals.has(object.name),
		};
	}

	// `strictAssert.equal(…)` where `strictAssert` is `import {strict as strictAssert} from 'node:assert'`.
	if (isNamedStrictAssertIdentifier(object, imports)) {
		return {
			method: callee.property.name,
			methodNode: callee.property,
			isStrict: true,
		};
	}

	// `assert.strict.equal(…)`
	if (isAssertStrictMember(object, imports)) {
		return {
			method: callee.property.name,
			methodNode: callee.property,
			isStrict: true,
		};
	}

	// `t.assert.strictEqual(…)`: `t.assert` is always loose mode. The receiver must be a plain identifier (a test context parameter); deeper chains like `a.b.assert.equal(…)`, `this.assert`, or `foo().assert` are unrelated objects that merely have an `assert` property.
	if (isTestContextAssertMember(object)) {
		return {
			method: callee.property.name,
			methodNode: callee.property,
			isStrict: false,
			contextReceiver: object.object,
		};
	}
}

/**
Classify a `CallExpression` as a `node:assert` assertion call.

Matches:
- `assert.strictEqual(…)` / `assert(…)` (namespace import)
- `assert.strict.equal(…)` / `assert.strict(…)` / `strictAssert.equal(…)` / `strictAssert(…)` (strict namespace)
- `strictEqual(…)` (named import)
- `t.assert.strictEqual(…)` (`TestContext#assert`)

`methodNode` is the identifier node holding the method name, which fixers rewrite. It is the callee itself for a named import, the property for member method calls, and `undefined` for callable assert forms like `assert(…)`, `assert.strict(…)`, or `strictAssert(…)`. `isStrict` is `true` when the binding resolves to a strict-mode assert API, where the legacy methods already behave strictly.

@returns {{method: string, methodNode: import('estree').Node | undefined, isStrict: boolean, contextReceiver?: import('estree').Identifier}|undefined}
*/
export const parseAssertionCall = memoizeByNode(parseAssertionCallCache, (callExpression, imports) => {
	const {callee} = callExpression;

	if (
		callee.type === 'Identifier'
		&& imports.assertNamed.get(callee.name) === 'strict'
		&& isImportedBindingReference(callee, imports)
	) {
		return {
			method: 'ok',
			methodNode: undefined,
			isStrict: true,
		};
	}

	// `strictEqual(…)` — named import.
	if (
		callee.type === 'Identifier'
		&& imports.assertNamed.has(callee.name)
		&& isImportedBindingReference(callee, imports)
	) {
		return {
			method: imports.assertNamed.get(callee.name),
			methodNode: callee,
			isStrict: imports.strictAssertLocals.has(callee.name),
		};
	}

	if (
		callee.type === 'Identifier'
		&& imports.assertNamespace.has(callee.name)
		&& isImportedBindingReference(callee, imports)
	) {
		// `assert(value)` — the bare assert function (alias of `ok`); no method identifier to rewrite.
		return {
			method: 'ok',
			methodNode: undefined,
			isStrict: imports.strictAssertLocals.has(callee.name),
		};
	}

	const memberAssertionCall = parseAssertionMemberCall(callee, imports);
	if (memberAssertionCall) {
		return memberAssertionCall;
	}

	return undefined;
});
