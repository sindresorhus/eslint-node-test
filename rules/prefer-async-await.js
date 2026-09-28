import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	getHookCallback,
	getTestCallback,
	createContextTracker,
	isContextHookCall,
} from './utils/node-test.js';
import {unwrapExpression} from './utils/index.js';

const MESSAGE_ID = 'prefer-async-await/error';

const messages = {
	[MESSAGE_ID]: 'Prefer async/await instead of returning a Promise.',
};

/**
Collect all `return` statements that are directly inside `block`, descending
into control-flow nodes but not into nested functions.

@param {import('estree').BlockStatement} block
@returns {import('estree').ReturnStatement[]}
*/
function findReturnStatements(block) {
	const results = [];

	function walk(node) {
		if (!node) {
			return;
		}

		switch (node.type) {
			case 'ReturnStatement': {
				results.push(node);
				break;
			}

			case 'BlockStatement': {
				for (const statement of node.body) {
					walk(statement);
				}

				break;
			}

			case 'IfStatement': {
				walk(node.consequent);
				walk(node.alternate);
				break;
			}

			case 'SwitchStatement': {
				for (const switchCase of node.cases) {
					for (const statement of switchCase.consequent) {
						walk(statement);
					}
				}

				break;
			}

			case 'TryStatement': {
				walk(node.block);
				if (node.handler) {
					walk(node.handler.body);
				}

				walk(node.finalizer);
				break;
			}

			case 'ForStatement':
			case 'ForInStatement':
			case 'ForOfStatement':
			case 'WhileStatement':
			case 'DoWhileStatement':
			case 'LabeledStatement':
			case 'WithStatement': {
				walk(node.body);
				break;
			}

			// Do not descend into nested functions
			default: {
				break;
			}
		}
	}

	walk(block);

	return results;
}

/**
Check whether a node contains a `.then(...)` call anywhere in its `.then`/`.catch`/`.finally`
member chain.

@param {import('estree').Node | null | undefined} node
@returns {boolean}
*/
function containsThen(node) {
	while (node) {
		// Unwrap optional chaining and TypeScript wrappers so `return foo.then(…) as Promise<void>`
		// and `foo?.then(…)` read the same as a bare `.then()` chain.
		node = unwrapExpression(node);
		if (node.type !== 'CallExpression') {
			return false;
		}

		const callee = unwrapExpression(node.callee);
		if (callee.type !== 'MemberExpression') {
			return false;
		}

		if (
			callee.property.type === 'Identifier'
			&& callee.property.name === 'then'
		) {
			return true;
		}

		node = callee.object;
	}

	return false;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Subtests (`t.test(…)`) and hooks declared on a context (`t.beforeEach(…)`) are method calls on
	// a context parameter, not imported bindings, so the tracker is needed to see them alongside the
	// imported `test`/`it` spellings.
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		// Query the tracker before it learns about this call, so the receiver is the enclosing context.
		const isSubtest = tracker.isSubtestCall(node);
		const isContextHook = isContextHookCall(node, tracker.isContextReceiver);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		if (!parsed && !isSubtest && !isContextHook) {
			return;
		}

		// `node:test` awaits a `describe`/`suite` callback, but `no-async-describe` forbids an async one (a rejection cancels every test the suite already registered), so converting it to async/await would only trade this report for that one.
		if (parsed?.kind === 'suite') {
			return;
		}

		// A context hook (`t.beforeEach(…)`) takes only a callback, so a function in a later slot is
		// dead code there too.
		const callback = isContextHook ? getHookCallback(node) : getTestCallback(node, imports);
		// Only flag non-async functions with a block body (arrow shorthand already returns)
		if (!callback || callback.async || callback.body.type !== 'BlockStatement') {
			return;
		}

		const returnStatements = findReturnStatements(callback.body);
		if (returnStatements.length === 0) {
			return;
		}

		// Flag if any return statement returns a .then() call chain
		for (const returnStatement of returnStatements) {
			if (containsThen(returnStatement.argument)) {
				return {
					node: callback,
					messageId: MESSAGE_ID,
				};
			}
		}

		// Flag if any return statement returns a variable that was assigned from a .then() call
		for (const returnStatement of returnStatements) {
			if (returnStatement.argument?.type !== 'Identifier') {
				continue;
			}

			const variable = findVariable(sourceCode.getScope(returnStatement), returnStatement.argument);
			if (!variable) {
				continue;
			}

			const assignedFromThen = variable.defs.some(definition => {
				// A destructuring declarator binds a property read off the chain, not the chain
				// itself. Destructuring does not await, so `const {length} = p.then(f)` reads `length`
				// off the Promise (`undefined`), and returning it does not return a Promise. A
				// declarator whose `id` is a plain Identifier binds exactly the name being returned,
				// so nothing else has to be compared.
				if (definition.type !== 'Variable' || definition.node.id.type !== 'Identifier') {
					return false;
				}

				return containsThen(definition.node.init);
			}) || variable.references.some(reference => {
				// A reassignment holds the value just as a declaration does, and it is a write reference
				// rather than a definition, so the assigned expression comes from the assignment.
				if (!reference.isWrite()) {
					return false;
				}

				const {identifier} = reference;
				const {parent} = identifier;
				// Only a plain `=` assigns the chain itself; `bar += p.then(f)` produces a string.
				return parent?.type === 'AssignmentExpression'
					&& parent.operator === '='
					&& parent.left === identifier
					&& containsThen(parent.right);
			});
			if (assignedFromThen) {
				return {
					node: callback,
					messageId: MESSAGE_ID,
				};
			}
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Prefer async/await over returning a Promise.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
