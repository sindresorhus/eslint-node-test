#!/usr/bin/env node
import fs, {promises as fsAsync} from 'node:fs';
import process from 'node:process';
import {pathToFileURL} from 'node:url';
import enquirer from 'enquirer';
import plugin from '../index.js';

const rules = Object.keys(plugin.rules);
const resolveFile = file => new URL(`../${file}`, import.meta.url);

function checkFiles(ruleId) {
	const files = [
		`docs/rules/${ruleId}.md`,
		`rules/${ruleId}.js`,
		`test/${ruleId}.js`,
		`test/${ruleId}.js.snapshot`,
	];

	for (const file of files) {
		if (fs.existsSync(resolveFile(file))) {
			throw new Error(`\`${file}\` already exists.`);
		}
	}
}

async function renameFile(source, target) {
	source = resolveFile(source);
	target = resolveFile(target);

	if (fs.existsSync(source)) {
		await fsAsync.rename(source, target);
	}
}

async function sortReadmeRuleRow(ruleId) {
	const readmeFile = resolveFile('readme.md');
	const text = await fsAsync.readFile(readmeFile, 'utf8');
	await fsAsync.writeFile(readmeFile, sortReadmeRuleRows(text, ruleId));
}

function sortReadmeRuleRows(text, ruleId) {
	const lines = text.split('\n');
	const rowIndex = lines.findIndex(line => line.startsWith(`| [${ruleId}](`));
	if (rowIndex === -1) {
		return text;
	}

	const rowPattern = /^\| \[([^\]]+)\]\(/v;
	const [row] = lines.splice(rowIndex, 1);
	const ruleRowIndexes = lines
		.map((line, index) => rowPattern.test(line) ? index : undefined)
		.filter(index => index !== undefined);

	let insertAt = lines.findIndex(line => {
		const match = line.match(rowPattern);
		return match && match[1] > ruleId;
	});
	if (insertAt === -1) {
		insertAt = ruleRowIndexes.at(-1) + 1;
	}

	lines.splice(insertAt, 0, row);
	return lines.join('\n');
}

/*
Rewrite `from` to `to` only where it is a whole rule name.

A plain `replaceAll` also rewrites longer names that start with `from`, so renaming `test-title`
would turn the untouched `test-title-format` into `<new>-format` everywhere, including its readme
link and snapshot keys. Rule names are kebab-case, so a match bounded by anything outside
`[A-Za-z0-9_-]` is a whole name.
*/
function replaceRuleName(text, from, to) {
	const escaped = from.replaceAll(/[$()*+.?[\]^{|}]/g, String.raw`\$&`);
	return text.replaceAll(
		new RegExp(String.raw`(?<![\w-])${escaped}(?![\w-])`, 'gu'),
		() => to,
	);
}

function replaceRuleIdInRulesIndex(text, from, to) {
	const fromLine = `export {default as '${from}'} from './${from}.js';`;
	const toLine = `export {default as '${to}'} from './${to}.js';`;
	return text.replace(fromLine, () => toLine);
}

async function renameRule(from, to) {
	await renameFile(`docs/rules/${from}.md`, `docs/rules/${to}.md`);
	await renameFile(`rules/${from}.js`, `rules/${to}.js`);
	await renameFile(`test/${from}.js`, `test/${to}.js`);
	await renameFile(`test/${from}.js.snapshot`, `test/${to}.js.snapshot`);

	const files = [
		'readme.md',
		'index.js',
		'rules/index.js',
		`docs/rules/${to}.md`,
		`rules/${to}.js`,
		`test/${to}.js`,
		`test/${to}.js.snapshot`,
	];

	for (const filePath of files) {
		const file = resolveFile(filePath);

		if (!fs.existsSync(file)) {
			continue;
		}

		// eslint-disable-next-line no-await-in-loop
		let text = await fsAsync.readFile(file, 'utf8');
		text = file.pathname.endsWith('/rules/index.js')
			? replaceRuleIdInRulesIndex(text, from, to)
			: replaceRuleName(text, from, to);
		// eslint-disable-next-line no-await-in-loop
		await fsAsync.writeFile(file, text);
	}

	await sortReadmeRuleRow(to);
}

const run = async () => {
	const ruleSelector = new enquirer.AutoComplete({
		message: 'Select the rule you want rename:',
		limit: 10,
		choices: rules,
	});
	const originalRuleId = await ruleSelector.run();

	const ruleNamePrompt = new enquirer.Input({
		message: 'New name:',
		initial: originalRuleId,
	});
	const ruleId = await ruleNamePrompt.run();

	if (!ruleId || originalRuleId === ruleId) {
		return;
	}

	if (rules.includes(ruleId)) {
		console.log(`${ruleId} already exists.`);
		return;
	}

	checkFiles(ruleId);
	await renameRule(originalRuleId, ruleId);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await run();
}

export {
	replaceRuleIdInRulesIndex,
	replaceRuleName,
	sortReadmeRuleRows,
};
