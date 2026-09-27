import {findVariable, getStaticValue} from '@eslint-community/eslint-utils';
import isFunction from '../ast/is-function.js';
import {getStaticPropertyName} from './is-same-reference.js';
import unwrapTypeScriptExpression, {isTypeScriptExpressionWrapper} from './unwrap-typescript-expression.js';

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

/** Canonical test functions that expose static `node:test` APIs. */
const TEST_FUNCTIONS = new Set(['test', 'it']);
/** Canonical test exports, including the standalone `expectFailure` function. */
const TEST_EXPORTS = new Set([...TEST_FUNCTIONS, 'expectFailure']);
/** Standalone aliases for `test.only()`, `test.skip()`, and `test.todo()`. */
const TEST_MODIFIER_EXPORTS = new Set(['only', 'skip', 'todo']);
const SUITE_FUNCTIONS = new Set(['describe', 'suite']);
const HOOK_FUNCTIONS = new Set(['before', 'after', 'beforeEach', 'afterEach']);
const ALL_TEST_EXPORTS = new Set([...TEST_EXPORTS, ...SUITE_FUNCTIONS, ...HOOK_FUNCTIONS, 'getTestContext', 'mock']);
const CONFIGURATION_EXPORTS = new Set(['assert', 'snapshot']);

export {TEST_FUNCTIONS, HOOK_FUNCTIONS};

/** Modifier names usable as `test.only()`, `test.skip()`, `test.todo()`. */
const MODIFIERS = new Set(['only', 'skip', 'todo']);
export {MODIFIERS};

const TEST_MODULE = 'node:test';
/** Module specifiers that resolve to Node's built-in `assert` module. */
export const ASSERT_MODULES = new Set(['node:assert', 'node:assert/strict', 'assert', 'assert/strict']);

/**
Scan a file's top-level imports and resolve the local bindings for
`node:test` and `node:assert`.

@returns {{
	locals: Map<string, string>,
	namespaces: Set<string>,
	configurationLocals: Map<string, string>,
	testModifierLocals: Map<string, string>,
	assertNamespace: Set<string>,
	assertNamed: Map<string, string>,
	strictAssertLocals: Set<string>,
	mockLocals: Set<string>,
	getTestContextName: string | undefined,
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
	if (source === TEST_MODULE) {
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

/**
The name an import specifier brings in, whether it is written bare (`import {strict}`) or as a string
literal (`import {'strict' as s}`), which are the same export.
*/
export function getImportSpecifierName(specifier) {
	if (specifier.imported.type === 'Identifier') {
		return specifier.imported.name;
	}

	return typeof specifier.imported.value === 'string' ? specifier.imported.value : undefined;
}

/** Collect bindings from an ESM `import` declaration. */
function collectFromImport(node, bindings) {
	if (node.importKind === 'type') {
		return;
	}

	const {value: source} = node.source;
	const kind = moduleKind(source);
	if (!kind) {
		return;
	}

	const isStrict = source.endsWith('/strict');

	for (const specifier of node.specifiers) {
		if (specifier.importKind === 'type') {
			continue;
		}

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
				bindings.namespaces.add(localName);
			} else if (TEST_MODIFIER_EXPORTS.has(importedName)) {
				bindings.testModifierLocals.set(localName, importedName);
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
			bindings.namespaces.add(localName);
		} else {
			// `import * as nodeTest from 'node:test'`.
			bindings.namespaces.add(localName);
		}
	}
}

function scanImports(context) {
	const bindings = {
		sourceCode: context.sourceCode,
		// Map of local identifier name -> canonical `node:test` export name.
		locals: new Map(),
		// Local names bound to the whole `node:test` module, whether by `import * as …` or by
		// `import test from 'node:test'` (the default export carries the named exports too). A file
		// may have more than one, so this is a set: the last import must not displace the others.
		namespaces: new Set(),
		// Map of local identifier name -> process-wide `node:test` configuration object.
		configurationLocals: new Map(),
		// Map of local standalone modifier aliases to their canonical modifier names.
		testModifierLocals: new Map(),
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

	const {locals, assertNamespace, assertNamed} = bindings;
	// The file imports test/suite/hook bindings from `node:test`.
	const isTestFile = locals.size > 0 || bindings.namespaces.size > 0 || bindings.testModifierLocals.size > 0;
	// The file imports anything from `node:assert`.
	const hasAssert = assertNamespace.size > 0 || assertNamed.size > 0;
	return {
		...bindings,
		sourceCode: context.sourceCode,
		// Local names bound to the `mock` export (`import {mock} from 'node:test'`, renamed too).
		mockLocals: new Set([...locals].filter(([, canonical]) => canonical === 'mock').map(([local]) => local)),
		// The local name bound to the `getTestContext` export, which is not `getTestContext` itself
		// under an alias, so a rule that names the call must spell the name the file actually bound.
		getTestContextName: [...locals].find(([, canonical]) => canonical === 'getTestContext')?.[0],
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

/**
Whether a node references the global `mock` — a named/renamed import, `namespace.mock`, or `test.mock`/`it.mock`.
*/
export function isGlobalMock(node, imports) {
	node = unwrapTypeScriptExpression(node);
	if (node.type === 'Identifier') {
		return imports.mockLocals.has(node.name) && isImportedBindingReference(node, imports);
	}

	if (
		node.type !== 'MemberExpression'
		|| node.computed
		|| node.property.type !== 'Identifier'
		|| node.property.name !== 'mock'
	) {
		return false;
	}

	const object = unwrapTypeScriptExpression(node.object);
	return object.type === 'Identifier'
		&& (
			imports.namespaces.has(object.name)
			|| TEST_FUNCTIONS.has(imports.locals.get(object.name))
		)
		&& isImportedBindingReference(object, imports);
}

/** Check whether a call resolves to `getTestContext()` from `node:test`. */
export function isGetTestContextCall(node, imports) {
	if (node.type !== 'CallExpression') {
		return false;
	}

	const chain = getCalleeChain(node.callee);
	if (!chain || !isImportedBindingReference(chain.root, imports)) {
		return false;
	}

	const {root, members} = chain;
	// `import {getTestContext}` binds the function itself; `test.getTestContext()` reads the same
	// function off the test binding, which a default, named, or namespace import all provide.
	const isTestBinding = imports.namespaces.has(root.name)
		|| TEST_FUNCTIONS.has(imports.locals.get(root.name));
	// `nodeTest.test.getTestContext()` is the same call through a namespace's test export. A namespace
	// reaches it as `it` and as `default` too, since all three are the same function, while
	// `nodeTest.describe.getTestContext` does not exist.
	const isNamespaceTestChain = members.length === 2
		&& (TEST_FUNCTIONS.has(members[0].name) || members[0].name === 'default')
		&& members[1].name === 'getTestContext'
		&& imports.namespaces.has(root.name);
	return (
		(imports.locals.get(root.name) === 'getTestContext' && members.length === 0)
		|| (members.length === 1 && members[0].name === 'getTestContext' && isTestBinding)
		|| isNamespaceTestChain
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

Why a symbol-keyed property on the node instead of a `WeakMap`:

- Cost per lookup. This runs for every call in the file, for nearly every rule, so the lookup itself dominates. A symbol-keyed property read is a plain property load (~1ns); a `WeakMap.get` hashes the key and probes a table (~7ns), several times slower.
- Garbage collection. A `WeakMap` keyed by AST nodes holds an ephemeron for every node that was ever looked up, i.e. most of the AST. The collector has to process those ephemerons on every major GC (iteratively, since ephemeron liveness depends on other ephemerons), which showed up as a large share of GC time in profiles. A property on the node lives and dies with the node, and costs the collector nothing extra.
- Lifetime. Nodes are created per parse and discarded with the AST, so the cached value cannot outlive or leak across files.

Symbol keys are invisible to `Object.keys`, `for…in`, `JSON.stringify`, and AST traversal (which walks `visitorKeys`), so no rule, fixer, or serializer reads them. They are not invisible to object spread: `{...node}` copies own enumerable symbol keys, so a synthesized copy of a node inherits its cache. No caller passes such a copy to `getCalleeChain`; `memoizeByNode` guards against it. ESLint and its parsers do not freeze nodes.
*/
const CALLEE_CHAIN = Symbol('calleeChain');

// Sentinel stored for callees with no chain, so a cache hit is a single property read even when the
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

	const cached = node[CALLEE_CHAIN];
	if (cached !== undefined) {
		return cached === NO_CHAIN ? undefined : cached;
	}

	const result = computeCalleeChain(node);
	node[CALLEE_CHAIN] = result ?? NO_CHAIN;
	return result;
}

/**
Whether an identifier name is bound to any `node:test` import in this file.
*/
function isTestBindingName(name, imports) {
	return imports.locals.has(name)
		|| imports.namespaces.has(name)
		|| imports.testModifierLocals.has(name);
}

/**
Classify a canonical export name as a test, suite, or hook (or `undefined`).
*/
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

function getStaticExportCall(testFunctionName, members) {
	const [first, ...rest] = members;
	if (first && ALL_TEST_EXPORTS.has(first.name)) {
		const hasExpectedFailure = first.name === 'expectFailure' || rest[0]?.name === 'expectFailure';
		return {
			name: first.name === 'expectFailure' ? testFunctionName : first.name,
			modifiers: hasExpectedFailure ? rest.slice(1) : rest,
			hasExpectedFailure,
		};
	}

	return {
		name: testFunctionName,
		modifiers: members,
		hasExpectedFailure: false,
	};
}

function getStaticTestFunctionName(root, firstMember, imports) {
	if (imports.namespaces.has(root.name) && !imports.locals.has(root.name) && firstMember?.name === 'default') {
		return 'test';
	}

	if (
		TEST_FUNCTIONS.has(firstMember?.name)
		&& (
			imports.namespaces.has(root.name)
			|| TEST_FUNCTIONS.has(imports.locals.get(root.name))
		)
	) {
		return firstMember.name;
	}
}

function getStaticTestCall(root, members, imports) {
	const firstMember = members[0];
	if (
		TEST_MODIFIER_EXPORTS.has(firstMember?.name)
		&& members.length === 1
		&& imports.namespaces.has(root.name)
		&& !imports.locals.has(root.name)
	) {
		return {
			name: 'test',
			modifiers: [firstMember],
			hasExpectedFailure: false,
			hasStandaloneModifier: true,
		};
	}

	const testFunctionName = getStaticTestFunctionName(root, firstMember, imports);
	if (testFunctionName) {
		return getStaticExportCall(testFunctionName, members.slice(1));
	}

	if (
		firstMember
		&& ALL_TEST_EXPORTS.has(firstMember.name)
		&& (
			imports.namespaces.has(root.name)
			|| TEST_FUNCTIONS.has(imports.locals.get(root.name))
		)
	) {
		return getStaticExportCall(imports.locals.get(root.name) ?? 'test', members);
	}
}

/*
Memoize the `parse*Call` classifiers by node. The same `CallExpression` is parsed by many rules during one lint run (most rules call `parseTestCall`, and every assertion rule reaches `parseAssertionCall`, directly or through `parseSupportedAssertionCall`), and `imports` is stable per file (it is itself cached per AST), so the first parse can be reused across all of them.

Stored on the node under a symbol key, not in a `WeakMap`, for the reasons given at `CALLEE_CHAIN`. The `imports` guard makes the cache self-invalidating: it can only be hit with the same `imports` object it was computed for. The `node` guard makes a synthesized copy of a node (`{...node, callee}` copies the symbol) a miss rather than a stale hit.

The cached result object is shared between callers, so treat it as read-only — never mutate the returned `modifiers` array or reassign its fields.
*/
const PARSED_TEST_CALL = Symbol('parsedTestCall');
const PARSED_ASSERTION_CALL = Symbol('parsedAssertionCall');

const memoizeByNode = (key, compute) => (callExpression, imports) => {
	if (callExpression.type !== 'CallExpression') {
		return undefined;
	}

	const cached = callExpression[key];
	if (cached !== undefined && cached.node === callExpression && cached.imports === imports) {
		return cached.result;
	}

	const result = compute(callExpression, imports);
	callExpression[key] = {node: callExpression, imports, result};
	return result;
};

/**
Classify a `CallExpression` as a `node:test` test/suite/hook call.

@returns {{
	name: string,
	kind: 'test' | 'suite' | 'hook',
	modifiers: import('estree').Identifier[],
	hasExpectedFailure: boolean,
	hasStandaloneModifier?: boolean,
} | undefined}
*/
export const parseTestCall = memoizeByNode(PARSED_TEST_CALL, (callExpression, imports) => {
	const chain = getCalleeChain(callExpression.callee);
	if (!chain) {
		return undefined;
	}

	const {root, members} = chain;
	// Every branch below requires the root to be one of the file's `node:test` bindings, so gate on the
	// name first. Resolving the scope is the expensive part, and most calls in a file are unrelated.
	if (!isTestBindingName(root.name, imports) || !isImportedBindingReference(root, imports)) {
		return undefined;
	}

	let parsed;
	const standaloneModifier = imports.testModifierLocals.get(root.name);
	if (standaloneModifier && members.length === 0) {
		parsed = {
			name: 'test',
			modifiers: [root.name === standaloneModifier ? root : {...root, name: standaloneModifier}],
			hasExpectedFailure: false,
			hasStandaloneModifier: true,
		};
	} else {
		parsed = getStaticTestCall(root, members, imports);
	}

	if (!parsed && imports.locals.has(root.name)) {
		// `test.only(…)` / bare `test(…)` — a callable test binding. A binding that is both a local and
		// the namespace (`import test from 'node:test'`) reaches here for member chains whose first
		// segment is not a known export, e.g. `test.only(…)`.
		const importedName = imports.locals.get(root.name);
		if (importedName === 'expectFailure') {
			parsed = {name: 'test', modifiers: [], hasExpectedFailure: true};
		} else {
			parsed = {
				name: importedName,
				modifiers: members[0]?.name === 'expectFailure' ? members.slice(1) : members,
				hasExpectedFailure: members[0]?.name === 'expectFailure',
			};
		}
	}

	if (!parsed) {
		return undefined;
	}

	if (parsed.modifiers.some(modifier => CONFIGURATION_EXPORTS.has(modifier.name))) {
		return undefined;
	}

	const kind = getCallKind(parsed.name);
	if (!kind) {
		return undefined;
	}

	return {...parsed, kind};
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
	if (!chain || chain.members[0]?.name !== 'test') {
		return undefined;
	}

	// Checked with a plain loop rather than `slice(1).every(…)`: this runs for every call in the file, for every rule that tracks contexts.
	const {members} = chain;
	for (let index = 1; index < members.length; index += 1) {
		if (!MODIFIERS.has(members[index].name)) {
			return undefined;
		}
	}

	return chain.root;
}

/*
Whether the call creates a subtest through a `getTestContext()` receiver, which has no identifier
for `getSubtestReceiver` to return.
*/
export function isGetTestContextSubtestCall(callExpression, imports) {
	const callee = unwrapTypeScriptExpression(callExpression.callee);
	return callee?.type === 'MemberExpression'
		&& !callee.computed
		&& callee.property.type === 'Identifier'
		&& callee.property.name === 'test'
		&& isGetTestContextCall(unwrapTypeScriptExpression(callee.object), imports);
}

/**
Whether the call creates a subtest: `t.test(…)` on a test context, or `getTestContext().test(…)`.

The second form has no identifier receiver, so a rule that matches the receiver against a tracked
context still has to ask for the receiver separately.
*/
export function isSubtestCall(callExpression, imports) {
	return getSubtestReceiver(callExpression) !== undefined
		|| isGetTestContextSubtestCall(callExpression, imports);
}

/**
Whether a call is a `<context>.beforeEach(…)`-style hook declared on a test context. The `isContextReceiver` predicate (typically `tracker.isContextReceiver`) decides whether the receiver reaches a test context, either as the context parameter or as a `getTestContext()` call.
*/
/**
The hook name of a `<context>.beforeEach(…)`-style call, or `undefined` when the call is not one.

The name is the member after the receiver, which reads the same for a context parameter and for a
`getTestContext()` call, whose callee chain cannot be walked down to an identifier.
*/
export function getContextHookName(callExpression) {
	const callee = unwrapTypeScriptExpression(callExpression.callee);
	return callee?.type === 'MemberExpression'
		&& !callee.computed
		&& callee.property.type === 'Identifier'
		&& HOOK_FUNCTIONS.has(callee.property.name)
		? callee.property.name
		: undefined;
}

export function isContextHookCall(callExpression, isContextReceiver) {
	if (getContextHookName(callExpression) === undefined) {
		return false;
	}

	return isContextReceiver(unwrapTypeScriptExpression(unwrapTypeScriptExpression(callExpression.callee).object));
}

function getParentCallExpression(node) {
	let {parent} = node;
	while (isTypeScriptExpressionWrapper(parent)) {
		const {parent: nextParent} = parent;
		parent = nextParent;
	}

	// The object form puts the callback in a descriptor property, so the call is one level further out.
	if (parent?.type === 'Property' && parent.parent?.type === 'ObjectExpression') {
		parent = parent.parent.parent;
	}

	return parent?.type === 'CallExpression' ? parent : undefined;
}

/**
Get the identifier for a simple test-context callback parameter, including a defaulted parameter.
*/
export function getContextParameterIdentifier(parameter) {
	if (parameter?.type === 'Identifier') {
		return parameter;
	}

	if (
		parameter?.type === 'AssignmentPattern'
		&& parameter.left.type === 'Identifier'
	) {
		return parameter.left;
	}

	return undefined;
}

// A TypeScript `this` parameter is erased at compile time, so it is not one of the emitted function's
// arguments.
const isTypeScriptThisParameter = parameter => parameter.type === 'Identifier' && parameter.name === 'this';

/*
The parameter at `index` that the compiled function still has, or `undefined` when it has fewer.
A TypeScript `this` parameter is erased at compile time, so it takes no argument slot.
*/
export function getRuntimeParameter(parameters, index) {
	return (parameters ?? [])
		.filter(parameter => !isTypeScriptThisParameter(parameter))[index];
}

/** Get the identifier a callback binds its test context to, or `undefined`. */
export function getFirstContextParameter(parameters) {
	const parameter = getRuntimeParameter(parameters, 0);
	return parameter && getContextParameterIdentifier(parameter);
}

/**
Track the test-context parameter names (`t`) introduced by enclosing test, subtest, and optionally hook callbacks, including hooks declared from a test context.

Subtests (`t.test(…)`) are method calls, not imported bindings, so recognizing them requires knowing the enclosing context name. Drive the tracker from a `CallExpression` visitor: query `isSubtestCall`/`isContextName` first (against the current stack), then call `update(node)` to push this call's own context, and `leave(node)` on exit.

Set `trackHooks` to also track hook context parameters.

@returns {{
	isSubtestCall: (node: import('estree').Node) => boolean,
	hasIdentifierSubtestReceiver: (node: import('estree').Node) => boolean,
	isContextIdentifier: (node: import('estree').Node | undefined) => boolean,
	isContextReceiver: (node: import('estree').Node | undefined) => boolean,
	isContextName: (name: string | undefined) => boolean,
	isContextNameInScope: (name: string | undefined, node: import('estree').Node) => boolean,
	currentContextVariable: () => import('eslint').Scope.Variable | undefined,
	current: () => string | undefined,
	currentCallback: () => import('estree').Node | undefined,
	isTrackedCallback: (node: import('estree').Node | undefined) => boolean,
	assertBinding: () => {getMethodName: (node: import('estree').Node) => string | undefined, isAssertObject: (node: import('estree').Node) => boolean},
	update: (node: import('estree').Node) => void,
	leave: (node: import('estree').Node) => void,
}}
*/
// Sentinels for the three outcomes of resolving an identifier against the destructured `assert`
// bindings. A method name is a plain string, so it never collides with either.
const NOT_ASSERT_BINDING = Symbol('not a destructured assert binding');
const ASSERT_OBJECT = Symbol('the destructured assert object');

export function createContextTracker(imports, {trackHooks = false} = {}) {
	const names = [];
	const variables = [];
	const callbacks = [];
	// Per tracked callback, the variables it destructures off the context's `assert`.
	const assertBindings = [];
	// The call nodes whose callbacks are on the stack, in the same order. Exits are nested, so `leave` only ever pops the top one.
	const calls = [];

	// A `var` that re-binds the callback's parameter resolves to the very same variable, so identity
	// alone cannot see that the name no longer reaches the test context. A context variable is only
	// the context while the parameter is its only definition.
	const isContextVariable = variable => variable !== undefined
		&& variables.includes(variable)
		&& variable.defs.length === 1
		&& variable.defs[0].type === 'Parameter';

	const isContextIdentifier = node => {
		// Resolving the scope is the expensive part; skip it entirely when no context is on the stack
		// (the common case for a call outside any tracked test/subtest/hook body).
		if (variables.length === 0 || node?.type !== 'Identifier') {
			return false;
		}

		return isContextVariable(getVariable(node, imports));
	};

	// A subtest is `<context>.test(…)` on a context this tracker knows, which for the
	// `getTestContext()` form means the innermost frame.
	const isTrackedSubtest = node => {
		const receiver = getSubtestReceiver(node);
		return receiver ? isContextIdentifier(receiver) : isSubtestCall(node, imports);
	};

	// The method name an identifier names, `ASSERT_OBJECT` for the destructured `assert` object
	// itself, or `NOT_ASSERT_BINDING` when it is not one. The three cases cannot share one return
	// value on their own, because a frame with no method records `undefined`.
	//
	// Every open frame is searched, like `isContextIdentifier` does: a closure over an outer test's
	// binding still refers to that binding after an inner callback is entered. A nested function
	// that re-binds the name has a different `Variable` and is not matched.
	const findAssertMethod = node => {
		if (assertBindings.length === 0 || node?.type !== 'Identifier') {
			return NOT_ASSERT_BINDING;
		}

		const variable = getVariable(node, imports);
		if (variable === undefined) {
			return NOT_ASSERT_BINDING;
		}

		for (const bindings of assertBindings) {
			if (bindings.has(variable)) {
				return bindings.get(variable) ?? ASSERT_OBJECT;
			}
		}

		return NOT_ASSERT_BINDING;
	};

	// A receiver that reaches a test context: the context parameter itself, or a `getTestContext()`
	// call, which has no identifier to match.
	const isContextReceiver = node => isContextIdentifier(node)
		|| isGetTestContextCall(unwrapTypeScriptExpression(node), imports);

	const isTrackedHookCall = (node, parsed) => trackHooks && (
		(
			parsed?.kind === 'hook'
			&& parsed.modifiers.length === 0
		)
		|| isHookMemberTestCall(parsed)
		|| isContextHookCall(node, isContextReceiver)
	);

	const isTrackedTestCall = parsed => parsed?.kind === 'test'
		&& parsed.modifiers.every(modifier => MODIFIERS.has(modifier.name));

	// Whether `name` still resolves to one of the open contexts' parameters at `node`. A nested
	// binding of the same name (a block-scoped `const t`, a `catch (t)`, a callback parameter) shadows
	// the context, so writing `name.diagnostic(…)` there would not reach the test context.
	const isContextNameInScope = (name, node) => {
		if (variables.length === 0 || name === undefined) {
			return false;
		}

		return isContextVariable(findVariable(imports.sourceCode.getScope(node), name));
	};

	return {
		isSubtestCall: isTrackedSubtest,
		// A receiver that reaches a test context, for `isContextHookCall` and friends.
		isContextReceiver,
		// Whether the subtest call has a context-parameter receiver, which the rules that name it in a
		// message need in order to tell `t.test(…)` from `getTestContext().test(…)`.
		hasIdentifierSubtestReceiver: node => getSubtestReceiver(node) !== undefined,
		isContextIdentifier,
		isContextName: name => name !== undefined && names.includes(name),
		isContextNameInScope,
		// The name of the innermost enclosing tracked context, or `undefined` when its
		// callback declared no context parameter (or we are not inside a tracked callback).
		current: () => names.at(-1),
		// The innermost enclosing context's parameter variable, which a `getTestContext()` call in the
		// same place refers to as well.
		currentContextVariable: () => variables.at(-1),
		// The callback function node of the innermost enclosing tracked callback. The context parameter is
		// only in scope inside this node, so a node visited in the call's title/options arguments (which
		// the traversal reaches before the callback) is not actually within the context's scope.
		currentCallback: () => callbacks.at(-1),
		isTrackedCallback: node => callbacks.includes(node),
		// Resolves an identifier against the destructured `assert` bindings of every open frame.
		assertBinding() {
			return {
				getMethodName(node) {
					const method = findAssertMethod(node);
					return typeof method === 'string' ? method : undefined;
				},
				isAssertObject: node => findAssertMethod(node) === ASSERT_OBJECT,
			};
		},
		update(node) {
			// Classify the call once and reuse the result for every check. This runs for every call in the file, for each of the ~45 rules that track contexts, so avoid re-parsing or re-walking the callee per check. `parseTestCall` is memoized per node, so it is cheap here.
			const parsed = parseTestCall(node, imports);
			const isHook = isTrackedHookCall(node, parsed);
			if (!isHook && !isTrackedTestCall(parsed) && !isTrackedSubtest(node)) {
				return;
			}

			const callback = isHook ? getHookCallback(node) : getTestCallback(node, imports);
			if (callback) {
				const parameter = getFirstContextParameter(callback.params);

				names.push(parameter?.name);
				variables.push(parameter ? getDeclaredVariable(parameter, callback, imports) : undefined);
				assertBindings.push(getDestructuredAssertBindings(callback, imports));
				callbacks.push(callback);
				calls.push(node);
			}
		},
		leave(node) {
			// ESLint exits nodes in strict nesting order, so a tracked call is always the top of `calls` when its exit fires. Comparing the top replaces the `Set` membership check that ran for every call exit in every tracking rule.
			if (calls.at(-1) !== node) {
				return;
			}

			calls.pop();
			names.pop();
			variables.pop();
			assertBindings.pop();
			callbacks.pop();
		},
	};
}

/**
Classify a `CallExpression` as a `node:assert` assertion whose receiver this file can reason about.

Like `parseAssertionCall`, but also rejects a `<receiver>.assert.*()` call whose receiver is not a tracked test context — `foo.assert.equal(…)` is an unrelated object's method, not an assertion. Imported `node:assert` forms have no `contextReceiver` and are always accepted.

Assertion rules should prefer this over `parseAssertionCall`, so the context check cannot be forgotten.
*/
export function parseSupportedAssertionCall(callExpression, imports, tracker) {
	const parsed = parseAssertionCall(callExpression, imports);
	if (parsed) {
		// The receiver is a real test context when it is either a tracked context parameter or a
		// `getTestContext()` call; anything else (`foo.assert.equal(…)`) is an unrelated object.
		return parsed.contextReceiver !== undefined
			&& !tracker.isContextIdentifier(parsed.contextReceiver)
			&& !isGetTestContextCall(parsed.contextReceiver, imports)
			? undefined
			: parsed;
	}

	return parseDestructuredAssertCall(callExpression, tracker.assertBinding());
}

/**
Classify a call that reaches `TestContext#assert` through a destructured binding.

`({assert}) => assert.ok(…)` and the method form `({assert: {ok}}) => ok(…)` both call a real
assertion. `TestContext#assert` is always loose mode, it is a plain object rather than a callable,
and it has no `strict` view, so `assert(…)` and `assert.strict.equal(…)` are both a `TypeError` at
runtime and are not assertions.

@param {object} callExpression The call to classify.
@param {object} assertBinding The destructured `assert` bindings, as returned by `getDestructuredAssertBindings`, which tell a method binding from the assert object.
@returns {{method: string, methodNode: import('estree').Node, isStrict: boolean} | undefined}
*/
export function parseDestructuredAssertCall(callExpression, assertBinding) {
	const callee = unwrapTypeScriptExpression(callExpression.callee);

	// A method destructured straight off `assert`, called on its own.
	if (callee.type === 'Identifier') {
		const method = assertBinding.getMethodName(callee);
		return method === undefined ? undefined : {method, methodNode: callee, isStrict: false};
	}

	if (callee.type !== 'MemberExpression' || callee.computed || callee.property.type !== 'Identifier') {
		return undefined;
	}

	// `assert.ok(…)` on the destructured assert object.
	const object = unwrapTypeScriptExpression(callee.object);
	return assertBinding.isAssertObject(object)
		? {method: callee.property.name, methodNode: callee.property, isStrict: false}
		: undefined;
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
Whether `node` is the callback of a test, suite, or subtest call that names it out of line, as in
`test('a', body)` with `const body = () => {}` declared somewhere else. The runner runs that function
as the test's body, so a rule that scopes what a callback declares has to treat it like an inline
callback. The traversal reaches the function in declaration order, so the call naming it may be
visited before or after it, which is why the check runs from the function.

@param {import('estree').Node} node The function to check.
@param {import('eslint').Rule.RuleContext} context
@param {object} imports The result of `resolveImports`.
@returns {boolean}
*/
/**
Whether `variable` is a function parameter that nothing re-binds. A `var` of the same name in the
body resolves to the very same variable, so identity alone cannot see that the name no longer reaches
the parameter's value.

@param {import('eslint').Scope.Variable | undefined} variable
@returns {boolean}
*/
export function isUnreboundParameter(variable) {
	return variable !== undefined
		&& variable.defs.length === 1
		&& variable.defs[0].type === 'Parameter';
}

/*
The test, suite, subtest or hook call that runs the function `node` as its callback, when the call
names it out of line (`test('a', body)`). The function is traversed where it is DECLARED, so the call
has to be found by resolving the binding back to the reference that passes it.

`isContextReceiver` is what tells a context hook (`t.beforeEach(…)`) from an ordinary method call, and
is only needed by a rule that already has a context tracker.
*/
export function getOutOfLineCallbackCall(node, context, imports, isContextReceiver) {
	if (!isFunction(node)) {
		return undefined;
	}

	// Only a named binding can be referenced out of line, and the shape check keeps the scope
	// resolution below for the few functions that could be one.
	const declarator = node.parent?.type === 'VariableDeclarator' && node.parent.init === node ? node.parent : undefined;
	const identifier = node.type === 'FunctionDeclaration' ? node.id : declarator?.id;
	if (identifier?.type !== 'Identifier') {
		return undefined;
	}

	const variable = findVariable(context.sourceCode.getScope(node.parent), identifier);
	return variable?.references
		.map(reference => getCallbackArgumentCall(reference.identifier, imports, isContextReceiver))
		.find(Boolean);
}

export function isOutOfLineCallback(node, context, imports, isContextReceiver) {
	return getOutOfLineCallbackCall(node, context, imports, isContextReceiver) !== undefined;
}

/** The test, suite, subtest or hook call `identifier` is passed to as its callback, if any. */
function getCallbackArgumentCall(identifier, imports, isContextReceiver) {
	let {parent} = identifier;
	// The object form names the callback `fn` in a descriptor property, so the call is one level
	// further out and the identifier is inside the object rather than a bare argument.
	if (parent?.type === 'Property' && parent.value === identifier) {
		if (getStaticPropertyName(parent) !== 'fn') {
			return undefined;
		}

		parent = parent.parent?.parent;
		if (parent?.type !== 'CallExpression') {
			return undefined;
		}
	} else if (parent?.type !== 'CallExpression' || !parent.arguments.includes(identifier)) {
		return undefined;
	}

	const isCallbackCall = parseTestCall(parent, imports) !== undefined
		|| getSubtestReceiver(parent) !== undefined
		|| (Boolean(isContextReceiver) && isContextHookCall(parent, isContextReceiver));
	return isCallbackCall ? parent : undefined;
}

/**
Whether the file's `getTestContext` import still reaches `node`, i.e. no local binding shadows it.
The import is a binding like any other, so a declaration in a test body hides it.

@param {object} imports The result of `resolveImports`.
@param {import('estree').Node} node The node the name has to resolve at.
@returns {boolean}
*/
export function isGetTestContextInScope(imports, node) {
	if (!imports.getTestContextName) {
		return false;
	}

	const variable = findVariable(imports.sourceCode.getScope(node), imports.getTestContextName);
	return variable?.defs.some(definition => definition.type === 'ImportBinding') ?? false;
}

/**
Get the node holding a statically-known string, or `undefined` when it is not one.

A `TemplateLiteral` is returned even with expressions, because callers read the literal text that
precedes the first expression.
*/
function getStaticStringNode(node, context) {
	node &&= unwrapTypeScriptExpression(node);
	if (!node) {
		return undefined;
	}

	if (node.type === 'Literal' && typeof node.value === 'string') {
		return node;
	}

	if (node.type === 'TemplateLiteral') {
		return node;
	}

	const staticValue = getStaticValue(node, context.sourceCode.getScope(node));
	return typeof staticValue?.value === 'string' ? node : undefined;
}

/**
Get the title node `node:test` actually names a test/suite with, when it is a static string.

`node:test` picks the title in this order:

- a leading object is the test descriptor, and its `name` is the title. Every later argument is ignored, so `test({name: 'a'}, fn)` is still named `a`.
- otherwise `options.name` wins over the positional title, so `test('a', {name: 'b'}, fn)` and `test(fn, {name: 'b'})` are both named `b`.
- otherwise the first argument is the title.
*/
export function getTestTitle(callExpression, context) {
	const titleNode = getTestTitleNode(callExpression);
	return titleNode && getStaticStringNode(titleNode, context);
}

/**
Get the node `node:test` reads a test's or suite's title from, whether or not it holds a static string, or `undefined` when the call names it with nothing at all.

This is `getTestTitle` without the static-string requirement, so a rule that has to report a *bad* title (not just read a good one) can reach the node. `undefined` means the call names the test from a slot this helper cannot pin down (a later spread or computed key, or an options argument that is not an object literal and so may carry a `name` of its own) or names it not at all (a descriptor with no `name`).
*/
/*
Whether a node sitting in the options slot could be the object `node:test` reads a `name` from. A
function there is the implementation, which is read as no options at all, and only a value that cannot
be an object rules the rest out: a literal or a template literal is a primitive, `undefined` and `NaN`
are primitives, and `-1`/`!x`/`void 0` evaluate to one. Everything else may hold an object, and a
`name` on it wins over the positional title.
*/
function couldBeOptionsObject(node) {
	node = unwrapTypeScriptExpression(node);
	return !isFunction(node)
		&& node.type !== 'Literal'
		&& node.type !== 'TemplateLiteral'
		&& node.type !== 'UnaryExpression'
		&& !(node.type === 'Identifier' && (node.name === 'undefined' || node.name === 'NaN'));
}

export function getTestTitleNode(callExpression) {
	const first = callExpression.arguments[0] && unwrapTypeScriptExpression(callExpression.arguments[0]);

	// A leading object is the descriptor, which `node:test` reads on its own. A plain options object
	// comes after the title, or after the callback in the function-first form.
	const isDescriptor = first?.type === 'ObjectExpression';
	const options = isDescriptor ? first : getTestOptions(callExpression);
	if (!options) {
		// A function in the first position is the implementation (`test(fn)` / `beforeEach(fn)`), never
		// a positional title. A call with no arguments has no first argument to return.
		if (isFunction(first)) {
			return undefined;
		}

		// `getTestOptions` answered `undefined` either because the slot is empty or because it holds
		// something other than an object literal, and `node:test` still reads `options.name` from
		// whatever is there. A slot that could hold an object may carry a name that beats the
		// positional title, so this helper cannot say which node holds it.
		const optionsArgument = callExpression.arguments[1];
		return optionsArgument && couldBeOptionsObject(optionsArgument) ? undefined : first;
	}

	const nameProperty = findOptionsProperty(options, 'name');
	// `findOptionsProperty` answers `undefined` both when there is no `name` and when a later spread
	// or an uninspectable computed key could have added or replaced one. Only the former may fall
	// back to the positional title; `node:test` still prefers `options.name` over it either way. A
	// computed key that folds to a constant names the same property a plain one does, so
	// `{['skip']: true}` cannot hide a name and does not throw the title away.
	if (!nameProperty && options.properties.some(property =>
		property.type === 'SpreadElement'
		|| (property.computed && getStaticPropertyName(property) === undefined))) {
		return undefined;
	}

	// A descriptor with no `name` means the test has no title, rather than a positional one.
	if (!nameProperty && isDescriptor) {
		return undefined;
	}

	// In the function-first form the first argument is the implementation, not a positional title, so
	// an options object with no `name` leaves the test with no title at all.
	if (!nameProperty && isFunction(first)) {
		return undefined;
	}

	// Unwrapped, the way the positional slot is, so a fix that rewrites the title leaves the cast or
	// the non-null assertion around it alone instead of deleting it.
	return nameProperty ? unwrapTypeScriptExpression(nameProperty.value) : first;
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
Whether a call takes its callback first, which is how a hook is spelled: `beforeEach(fn, options)`.
A test or suite starts with its title, so a function in the first position means a hook.

This is a shape test, not a resolved one. `node:test` also accepts `test(fn, options)`, which looks
the same but is a test. The two only differ in whether `options.fn` is read, and a function-first
test that also passes `options.fn` is too obscure to model.
*/
function isCallbackFirst(callExpression) {
	return getHookCallback(callExpression) !== undefined;
}

/**
Get the inline function implementation argument of a test, suite, or hook call.

`node:test` builds the test by spreading the options over the positional callback, so an `fn` in
the options slot wins: `test('a', {fn: first}, second)` runs `first` and never calls `second`. A hook
is the exception — it takes its callback first and the runner never reads `options.fn` for it.

Otherwise this is the first top-level function argument, which is the one `node:test` runs: a call
never gets a second positional callback, so `test('a', first, second)` runs `first` and leaves
`second` uncalled. The scan covers every positional `node:test` signature: `test(name, fn)`,
`test(name, options, fn)`, `test(name, options)`, and the hook forms `beforeEach(fn)` /
`beforeEach(fn, options)`, since the options object is never a function. A call with no callback
(`test(name, {skip: true})`) has none.

Pass `imports` so a hook call is read the way the runner reads it: its callback is only ever its
first argument, so `beforeEach({}, fn)` and `beforeEach({fn})` run nothing at all, and a rule must
not treat those dead functions as a live hook callback. A hook declared on a test context
(`t.beforeEach(…)`) is a method call that `parseTestCall` does not classify; callers that know it is
one should ask for `getHookCallback` themselves.
*/
/**
The function a test, suite, subtest or hook call runs as its callback, whether the call names it
directly or names a binding that reaches it.

`getTestCallback` answers only the first: an identifier argument is the callback by name, and the
function it reaches is declared elsewhere, which is still the function the runner calls. A rule that
reads what the callback contains needs the function itself, not the name.

@param {import('estree').CallExpression} callExpression
@param {import('eslint').Rule.RuleContext} context
@param {object} imports The result of `resolveImports`.
@returns {import('estree').Node | undefined} The callback function node, when there is one.
*/
export function getResolvedTestCallback(callExpression, context, imports) {
	const callback = getTestCallback(callExpression, imports);
	if (callback) {
		return callback;
	}

	// The callback may be named by an identifier in any argument slot, or by the `fn` property of the
	// descriptor, and the name may be something else entirely: the title is often a variable too.
	const identifiers = callExpression.arguments
		.map(argument => unwrapTypeScriptExpression(argument))
		.filter(argument => argument?.type === 'Identifier');
	const fnProperty = findOptionsProperty(getTestOptions(callExpression), 'fn');
	const fn = fnProperty && unwrapTypeScriptExpression(fnProperty.value);
	if (fn?.type === 'Identifier') {
		identifiers.push(fn);
	}

	for (const identifier of identifiers) {
		const variable = findVariable(context.sourceCode.getScope(identifier), identifier);
		for (const definition of variable?.defs ?? []) {
			// A `function body() {}` definition carries the declaration; `const body = () => {}` carries
			// the declarator, whose `init` is the function.
			const node = definition.type === 'FunctionName' ? definition.node : definition.node?.init;
			if (isFunction(node)) {
				return node;
			}
		}
	}

	return undefined;
}

export function getTestCallback(callExpression, imports) {
	const parsed = imports && parseTestCall(callExpression, imports);
	if (parsed?.kind === 'hook' || isHookMemberTestCall(parsed)) {
		return getHookCallback(callExpression);
	}

	if (!isCallbackFirst(callExpression)) {
		const optionsCallback = getOptionsCallback(callExpression);
		if (optionsCallback) {
			return optionsCallback;
		}
	}

	for (const argument of callExpression.arguments) {
		const unwrapped = unwrapTypeScriptExpression(argument);
		if (isFunction(unwrapped)) {
			return unwrapped;
		}
	}

	return undefined;
}

/**
Get the `fn` property of a call's options object, or `undefined` if there is none.

`node:test` reads `options.fn` wherever the options object sits, so `test({name, fn})`,
`test(name, {fn})` and `test(name, {fn}, other)` all run that function. Only the options slot is
consulted: a trailing object on a test that also passes a callback is ignored by the runner, so
`test('a', {fn}, {fn})` runs the first `fn` and not the second.
*/
function getOptionsCallback(callExpression) {
	const options = getTestOptions(callExpression);
	if (!options) {
		return undefined;
	}

	const fnProperty = findOptionsProperty(options, 'fn');
	const fn = fnProperty && unwrapTypeScriptExpression(fnProperty.value);
	return fn && isFunction(fn) ? fn : undefined;
}

/** Get the identifier a destructured property binds, unwrapping a default. */
function getDestructuredIdentifier(property) {
	if (property.type === 'Property' && property.value.type === 'Identifier') {
		return property.value;
	}

	return property.type === 'Property'
		&& property.value.type === 'AssignmentPattern'
		&& property.value.left.type === 'Identifier'
		? property.value.left
		: undefined;
}

/**
Find the scope variables a test callback destructures off its context's `assert`, each mapped to the
assertion method it was destructured from.

Covers `({assert})`, `({assert = fallback})` and `({assert: {ok, strictEqual}})`, since all of them
reach the real `TestContext#assert`. The variable bound to `assert` itself maps to `undefined`,
because it is the assert object rather than a method, and the two are used differently: `assert.ok(…)`
is a method call, while calling the object as `assert(…)` is not a call at all.

A method's name comes from the property it was destructured from, not from the local name, so
`({assert: {ok: check}}) => check(…)` is still recognised as `ok`.

@returns {Map<import('eslint').Scope.Variable, string | undefined>}
*/
export function getDestructuredAssertBindings(callback, imports) {
	// A TypeScript `this` parameter is erased at compile time, so the pattern that binds `assert` is
	// the next one along, the same way `getFirstContextParameter` reads it everywhere else.
	const parameter = getRuntimeParameter(callback.params, 0);
	if (parameter?.type !== 'ObjectPattern') {
		return new Map();
	}

	// The key may be written `'assert'` or `['assert']`, which bind the same property.
	const property = parameter.properties.find(property =>
		property.type === 'Property' && getStaticPropertyName(property) === 'assert');

	if (!property) {
		return new Map();
	}

	const bindings = new Map();
	const addBinding = (identifier, method) => {
		const variable = getVariable(identifier, imports);
		if (variable) {
			bindings.set(variable, method);
		}
	};

	const assertIdentifier = getDestructuredIdentifier(property);
	if (assertIdentifier) {
		addBinding(assertIdentifier, undefined);
	}

	// `({assert: {ok}})` destructures the methods straight off `assert`, so each one is its own
	// binding that a bare `ok(…)` call refers to.
	const nested = property.value.type === 'AssignmentPattern' ? property.value.left : property.value;
	if (nested.type === 'ObjectPattern') {
		for (const nestedProperty of nested.properties) {
			const nestedIdentifier = getDestructuredIdentifier(nestedProperty);
			if (nestedIdentifier) {
				addBinding(nestedIdentifier, getStaticPropertyName(nestedProperty));
			}
		}
	}

	return bindings;
}

/*
The number of parameters before the first default or rest parameter — the same value as `Function.prototype.length`. `node:test` uses this arity to decide whether to pass a `done` callback, so a declared second parameter means the function opted into callback style.

A TypeScript `this` parameter is erased at compile time, so it does not count towards the length of the emitted function and towards the arity the runner sees.
*/
export function getEffectiveArity(parameters) {
	let count = 0;
	for (const parameter of parameters) {
		if (parameter.type === 'AssignmentPattern' || parameter.type === 'RestElement') {
			break;
		}

		if (isTypeScriptThisParameter(parameter)) {
			continue;
		}

		count += 1;
	}

	return count;
}

/**
Get the options `ObjectExpression` argument of a test/suite/hook call, if any.

`node:test` reads the options from one fixed slot, so no scan is needed:

- a test/suite reads a leading object as the descriptor, and otherwise reads its second argument
- a hook takes its callback first, so it reads its second argument

Nothing past that slot is ever read, because the runner takes the argument before the callback as the
options: `test('a', fn, {skip: true})` runs `fn` and ignores the object entirely, whether `fn` is an
inline function, an identifier, or a member expression.
*/
export function getTestOptions(callExpression) {
	const {arguments: arguments_} = callExpression;
	const isDescriptor = !isCallbackFirst(callExpression)
		&& arguments_[0]
		&& unwrapTypeScriptExpression(arguments_[0]).type === 'ObjectExpression';
	const options = arguments_[isDescriptor ? 0 : 1];
	return options && unwrapTypeScriptExpression(options).type === 'ObjectExpression'
		? unwrapTypeScriptExpression(options)
		: undefined;
}

/**
Find the last statically-known property in an options object, whether its key is written bare, quoted, or computed from a constant. An uninspectable later property may override an earlier one, so it makes the earlier property unusable.
*/
export function findOptionsProperty(optionsObject, name) {
	if (optionsObject?.type !== 'ObjectExpression') {
		return undefined;
	}

	for (let index = optionsObject.properties.length - 1; index >= 0; index -= 1) {
		const property = optionsObject.properties[index];
		if (property.type === 'SpreadElement') {
			return undefined;
		}

		// A computed key that folds to a constant names the same property a literal one does, so
		// `{['skip']: true}` is the `{skip: true}` the runner reads. One that does not fold could be
		// the name being looked for, or could override an earlier property, so it makes every
		// property here unusable.
		const keyName = getStaticPropertyName(property);
		if (keyName === undefined) {
			return undefined;
		}

		if (keyName === name) {
			return property;
		}
	}

	return undefined;
}

/**
Find an options property that `node:test` acts on, or `undefined` when the value leaves it off.

The modifiers do not share one enablement rule:

- `only` is a plain truthiness check, so only a truthy value marks a test as the one to run.
- `skip`, `todo` and `expectFailure` mark a test with any value that is neither `undefined` nor
  `false`, so `{skip: 0}`, `{skip: ''}` and `{skip: null}` all carry the `# SKIP` directive that
  `{skip: true}` does, while `{skip: false}` and `{skip: undefined}` carry nothing. That is the
  directive, though, and not the body: only a truthy `skip` stops the callback from running, which is
  what `hasEnabledSkipOption` in `shared/skipped-test.js` asks about instead.

A value that cannot be resolved statically counts as enabled, which is the safe answer for a dynamic
option: the rules have always reported it, and it is more often on than off. A getter is the one
exception, because the accessor function is not the value the runner reads: what `get skip()` returns is
not knowable here, and a getter that returns `false` leaves the option off.
*/
export function findEnabledOptionsProperty(optionsObject, name, context) {
	const property = findOptionsProperty(optionsObject, name);
	if (!property || property.kind === 'get') {
		return undefined;
	}

	const value = unwrapTypeScriptExpression(property.value);
	const staticValue = getStaticValue(value, context.sourceCode.getScope(value));
	if (staticValue === null) {
		return property;
	}

	const isEnabled = name === 'only'
		? Boolean(staticValue.value)
		: staticValue.value !== undefined && staticValue.value !== false;

	return isEnabled ? property : undefined;
}

/*
`node:test` passes the plan count to the test runner as a `uint32`, so a plan is only real when the
option is a positive safe integer in that range. `plan: 0` runs the body and passes, and a negative
or non-numeric count never completes, so none of them declare a plan worth checking assertions
against.
*/
const MAX_PLAN_COUNT = 4_294_967_295;

/**
Whether a call declares a usable `plan` option, the same way `<context>.plan(n)` does.

The option and the method set the same expected assertion count, so every rule that asks "does this
test have a plan?" must agree on which values count. A value that cannot be resolved statically is
not a plan.
*/
export function hasEnabledPlanOption(callExpression, context) {
	const property = findOptionsProperty(getTestOptions(callExpression), 'plan');
	if (property === undefined) {
		return false;
	}

	const staticValue = getStaticValue(property.value, context.sourceCode.getScope(property.value));
	return isEnabledPlanCount(staticValue);
}

/**
Whether a statically-resolved value is a real, usable plan count (a positive safe `uint32`).
Both the `plan` option and `<context>.plan(…)` must satisfy this, so they agree on what counts.
*/
export function isEnabledPlanCount(staticValue) {
	return typeof staticValue?.value === 'number'
		&& Number.isSafeInteger(staticValue.value)
		&& staticValue.value > 0
		&& staticValue.value <= MAX_PLAN_COUNT;
}

/**
The kind of callback a registration call runs, or `undefined` when the call is not a registration.

A subtest (`t.test(…)`) and a context hook (`t.beforeEach(…)`) are method calls rather than imported
bindings, so telling them from an unrelated method call of the same shape needs `isContextReceiver`,
which is the tracker's `isContextReceiver`. A subtest is recognised structurally, the way
`getSubtestReceiver` already recognises it elsewhere.
*/
export function getRegistrationKind(call, imports, isContextReceiver) {
	if (!call) {
		return undefined;
	}

	const parsed = parseTestCall(call, imports);
	if (parsed?.kind === 'hook' && parsed.modifiers.length === 0) {
		return 'hook';
	}

	if (isHookMemberTestCall(parsed)) {
		return 'hook';
	}

	if (isContextReceiver && isContextHookCall(call, isContextReceiver)) {
		return 'hook';
	}

	if (parsed) {
		return parsed.kind;
	}

	// A subtest is recognised structurally, the way `getSubtestReceiver` recognises one everywhere
	// else: `<receiver>.test(…)`. The receiver is not resolved to a test context, because the caller
	// reads the callback where it is declared, which is outside the frame that would name it. An
	// unrelated object with a `test` method is therefore read as a subtest, the same trade-off
	// `getSubtestReceiver` already makes.
	return getSubtestReceiver(call) === undefined ? undefined : 'test';
}

/**
Determine the kind (`test`/`suite`/`hook`) of the nearest enclosing test-related callback.

Returns `undefined` when the nearest enclosing function is a regular function (e.g. a helper), or there is none. Subtests (`t.test(…)`) are method calls rather than imported bindings, so they are recognized structurally and classified as `'test'`. A callback the call names out of line (`test('a', body)`) is recognized by resolving the binding back to the call.
*/
export function nearestTestCallbackKind(node, imports, isContextReceiver, context) {
	let current = node.parent;
	while (current) {
		if (isFunction(current)) {
			const call = getParentCallExpression(current) ?? (context && getOutOfLineCallbackCall(current, context, imports, isContextReceiver));
			// Whether `call` runs `current` as its callback: from an argument slot it can only be the
			// function node itself, and out of line it is the function the binding resolves to.
			const isCallback = call !== undefined && (
				getHookCallback(call) === current
				|| getTestCallback(call, imports) === current
				|| getOutOfLineCallbackCall(current, context, imports, isContextReceiver) === call
			);
			// Inside some other function — not directly in a test/suite/hook body.
			return isCallback ? getRegistrationKind(call, imports, isContextReceiver) : undefined;
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
	node = unwrapTypeScriptExpression(node);
	const object = node.type === 'MemberExpression' ? unwrapTypeScriptExpression(node.object) : undefined;
	return (
		node.type === 'MemberExpression'
		&& !node.computed
		&& object?.type === 'Identifier'
		&& isAssertNamespaceIdentifier(object, imports)
		&& node.property.type === 'Identifier'
		&& node.property.name === 'strict'
	);
}

function isTestContextAssertMember(node, imports) {
	node = unwrapTypeScriptExpression(node);
	if (node.type !== 'MemberExpression' || node.computed) {
		return false;
	}

	if (node.property.type !== 'Identifier' || node.property.name !== 'assert') {
		return false;
	}

	const object = unwrapTypeScriptExpression(node.object);
	// The receiver is a test context when it is a plain identifier (a context parameter) or a
	// `getTestContext()` call. Deeper chains like `a.b.assert`, `this.assert`, or an unrelated
	// `foo().assert` are other objects that merely have an `assert` property.
	return object?.type === 'Identifier' || isGetTestContextCall(object, imports);
}

function parseAssertionMemberCall(callee, imports) {
	callee = unwrapTypeScriptExpression(callee);
	if (
		callee.type !== 'MemberExpression'
		|| callee.computed
		|| callee.property.type !== 'Identifier'
	) {
		return;
	}

	const object = unwrapTypeScriptExpression(callee.object);

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
			// A destructured context `assert` is `TestContext#assert`, which is always loose.
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

	// `t.assert.strictEqual(…)` / `getTestContext().assert.ok(…)`: the context `assert` is always loose mode.
	// `t.assert.strict` is excluded because the context assert has no `strict` view, so calling it throws.
	if (isTestContextAssertMember(object, imports) && callee.property.name !== 'strict') {
		return {
			method: callee.property.name,
			methodNode: callee.property,
			isStrict: false,
			contextReceiver: unwrapTypeScriptExpression(object.object),
		};
	}
}

/*
The legacy loose (`==`) assertion methods and their strict counterparts, which is what a rule needs
to tell a loose assertion from a strict one that behaves the same way.
*/
export const LOOSE_TO_STRICT_METHODS = new Map([
	['equal', 'strictEqual'],
	['notEqual', 'notStrictEqual'],
	['deepEqual', 'deepStrictEqual'],
	['notDeepEqual', 'notDeepStrictEqual'],
]);

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
export const parseAssertionCall = memoizeByNode(PARSED_ASSERTION_CALL, (callExpression, imports) => {
	const callee = unwrapTypeScriptExpression(callExpression.callee);

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
