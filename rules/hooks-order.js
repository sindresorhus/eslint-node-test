import {resolveImports, parseTestCall} from './utils/node-test.js';
import {skipExpressionWrappers} from './utils/index.js';

const MESSAGE_ID = 'hooks-order/error';

const messages = {
	[MESSAGE_ID]: 'Hook `{{current}}` must come before `{{invalid}}`.',
};

// Canonical order for node:test hooks.
const HOOK_ORDER = ['before', 'beforeEach', 'afterEach', 'after'];
const HOOK_ORDER_INDEX = Object.fromEntries(HOOK_ORDER.map((name, index) => [name, index]));

/*
Build the fix that reorders a block's hooks into canonical order in a single pass. Returns
`undefined` (no fix) when the hooks are not a contiguous run of statements, or a comment sits
between them — reordering would otherwise drop or misattribute code.
*/
function getReorderFix(block, hooks, sourceCode) {
	const positions = hooks.map(hook => block.body.indexOf(hook.statement));
	const min = Math.min(...positions);
	const max = Math.max(...positions);

	// Non-hook statements interleaved with the hooks.
	if (max - min + 1 !== hooks.length) {
		return undefined;
	}

	// A comment anywhere between consecutive hooks must not be moved.
	for (let index = min; index < max; index += 1) {
		if (sourceCode.getTokensBetween(block.body[index], block.body[index + 1], {includeComments: true}).length > 0) {
			return undefined;
		}
	}

	// A trailing comment on the last hook's line would stay put while the statement text moves,
	// misattributing it to whichever hook ends up last. The reorder replaces statement text only.
	const lastHook = block.body[max];
	const [trailingComment] = sourceCode.getCommentsAfter(lastHook);
	if (trailingComment && sourceCode.getLoc(trailingComment).start.line === sourceCode.getLoc(lastHook).end.line) {
		return undefined;
	}

	// Stable sort preserves the original order of same-named hooks.
	const sorted = hooks.toSorted((a, b) => HOOK_ORDER_INDEX[a.name] - HOOK_ORDER_INDEX[b.name]);

	return function * (fixer) {
		for (const [index, hook] of hooks.entries()) {
			if (sorted[index].statement !== hook.statement) {
				yield fixer.replaceText(hook.statement, sourceCode.getText(sorted[index].statement));
			}
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

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (parsed?.kind !== 'hook') {
			return;
		}

		const statement = skipExpressionWrappers(node.parent);
		if (statement?.type !== 'ExpressionStatement') {
			return;
		}

		const block = statement.parent;
		if (block?.type !== 'BlockStatement' && block?.type !== 'Program') {
			return;
		}

		let hooks = hooksByBlock.get(block);
		if (!hooks) {
			hooks = [];
			hooksByBlock.set(block, hooks);
		}

		hooks.push({name: parsed.name, statement});
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
