import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	isContextHookCall,
} from './utils/node-test.js';
import {skipExpressionWrappers} from './utils/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

// A statement starting with `(` or `[` continues the expression above it when the two end up
// adjacent, so the reorder has to separate them.
const STARTS_WITH_BRACKET = /^[([]/;

const MESSAGE_ID = 'hooks-order/error';

const messages = {
	[MESSAGE_ID]: 'Hook `{{current}}` must come before `{{invalid}}`.',
};

// Canonical order for node:test hooks.
const HOOK_ORDER = ['before', 'beforeEach', 'afterEach', 'after'];
const HOOK_ORDER_INDEX = Object.fromEntries(HOOK_ORDER.map((name, index) => [name, index]));

/*
The statements a container holds directly. A `switch` case names its statements `consequent`, while
every other statement list — a block, the program, a class static block — names them `body`.
*/
function getContainerStatements(block) {
	return block.type === 'SwitchCase' ? block.consequent : block.body;
}

/*
Build the fix that reorders a block's hooks into canonical order in a single pass. Returns
`undefined` (no fix) when the hooks are not a contiguous run of statements, or a comment sits
next to them — reordering would otherwise drop or misattribute code.
*/
function getReorderFix(block, hooks, sourceCode) {
	const statements = getContainerStatements(block);
	const positions = hooks.map(hook => statements.indexOf(hook.statement));
	const min = Math.min(...positions);
	const max = Math.max(...positions);

	// Non-hook statements interleaved with the hooks.
	if (max - min + 1 !== hooks.length) {
		return undefined;
	}

	// A comment anywhere between consecutive hooks must not be moved.
	for (let index = min; index < max; index += 1) {
		if (sourceCode.getTokensBetween(statements[index], statements[index + 1], {includeComments: true}).length > 0) {
			return undefined;
		}
	}

	const firstHook = statements[min];
	const lastHook = statements[max];

	// A comment leading the first hook describes that hook, and the reorder replaces statement
	// text only, so the comment would end up describing whichever hook moves into first place.
	// The same reasoning as the trailing comment below. A blank line between them means the
	// comment belongs to the block rather than to the hook, so that case stays fixable.
	// The run is in source order, so the comment nearest the hook is the last one, not the first.
	const leadingComment = sourceCode.getCommentsBefore(firstHook).at(-1);
	if (
		leadingComment
		&& sourceCode.getLoc(firstHook).start.line - sourceCode.getLoc(leadingComment).end.line <= 1
	) {
		return undefined;
	}

	// A trailing comment on the last hook's line would stay put while the statement text moves,
	// misattributing it to whichever hook ends up last. The reorder replaces statement text only.
	const [trailingComment] = sourceCode.getCommentsAfter(lastHook);
	if (trailingComment && sourceCode.getLoc(trailingComment).start.line === sourceCode.getLoc(lastHook).end.line) {
		return undefined;
	}

	// Stable sort preserves the original order of same-named hooks.
	const sorted = hooks.toSorted((a, b) => HOOK_ORDER_INDEX[a.name] - HOOK_ORDER_INDEX[b.name]);

	return function * (fixer) {
		for (const [index, hook] of hooks.entries()) {
			if (sorted[index].statement === hook.statement) {
				continue;
			}

			// The statement can be glued to either neighbour once it lands here: a leading `(`/`[`
			// continues the expression above it, and a missing trailing `;` lets the statement below
			// continue this one.
			const text = sourceCode.getText(sorted[index].statement);
			const prefix = index > 0 && STARTS_WITH_BRACKET.test(text) ? ';' : '';
			// The statement that lands below is the next hook, or the first statement after the block.
			const next = sorted[index + 1]?.statement ?? statements[max + 1];
			const nextText = next ? sourceCode.getText(next) : '';
			const suffix = !text.endsWith(';') && STARTS_WITH_BRACKET.test(nextText) ? ';' : '';
			yield fixer.replaceText(hook.statement, `${prefix}${text}${suffix}`);
		}
	};
}

function getBlockProblems(block, hooks, sourceCode) {
	const problems = [];
	let fix;
	let isFixComputed = false;

	for (const [position, hook] of hooks.entries()) {
		const index = HOOK_ORDER_INDEX[hook.name];
		// A hook that appears before the current one but belongs later means the current hook
		// is out of order and should have come first.
		const earlierConflict = hooks.slice(0, position).find(other => HOOK_ORDER_INDEX[other.name] > index);
		if (!earlierConflict) {
			continue;
		}

		// Compute the single block-wide reorder fix once, lazily, and share it across the
		// block's problems; ESLint applies it once and the re-lint finds the block sorted.
		if (!isFixComputed) {
			fix = getReorderFix(block, hooks, sourceCode);
			isFixComputed = true;
		}

		problems.push({
			node: hook.statement.expression,
			messageId: MESSAGE_ID,
			data: {current: hook.name, invalid: earlierConflict.name},
			fix,
		});
	}

	return problems;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Group bare-statement hooks by their containing block, in source order. Hooks used as a
	// sub-expression (`const x = before(…)`, `await before(…)`) cannot be moved safely and are
	// skipped. The containing block (a `describe` body or the program) is the ordering scope.
	const hooksByBlock = new Map();

	// A hook declared on a test context (`t.beforeEach(…)`) has the same canonical order as an
	// imported hook, so it is recognized through the tracker.
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		const isContextHook = isContextHookCall(node, tracker.isContextReceiver);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		const isHook = parsed?.kind === 'hook' || isContextHook;
		if (!isHook) {
			return;
		}

		// A context hook is named by the member after its receiver, which reads the same for a
		// context parameter and for a `getTestContext()` call; an imported hook is named by its export.
		const hook = isContextHook ? unwrapTypeScriptExpression(node.callee).property : parsed;
		const hookName = hook.name;

		const statement = skipExpressionWrappers(node.parent);
		if (statement?.type !== 'ExpressionStatement') {
			return;
		}

		// Every statement list a hook can be declared in, so the same order applies in all of them.
		const block = statement.parent;
		if (
			block?.type !== 'BlockStatement'
			&& block?.type !== 'Program'
			&& block?.type !== 'StaticBlock'
			&& block?.type !== 'SwitchCase'
		) {
			return;
		}

		let hooks = hooksByBlock.get(block);
		if (!hooks) {
			hooks = [];
			hooksByBlock.set(block, hooks);
		}

		hooks.push({name: hookName, statement});
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});

	context.onExit('Program', () => {
		const problems = [];

		for (const [block, hooks] of hooksByBlock) {
			problems.push(...getBlockProblems(block, hooks, sourceCode));
		}

		return problems;
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Enforce a consistent order of hook declarations.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
