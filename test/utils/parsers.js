import {fileURLToPath} from 'node:url';
import {
	typescriptEslintParser,
	vueEslintParser,
} from '../../scripts/parsers.js';

const typescriptParser = {
	name: 'typescript',
	implementation: typescriptEslintParser,
	mergeParserOptions: options => ({
		project: [],
		...options,
	}),
};

// Type-aware variant: provides full type information via the TypeScript project service.
// Cases using this parser must set `filename` to a `.ts` path inside `test/fixtures/`.
const fixturesDirectory = fileURLToPath(new URL('../fixtures/', import.meta.url));

const typescriptTypedParser = {
	name: 'typescriptWithTypes',
	implementation: typescriptEslintParser,
	mergeParserOptions: options => ({
		projectService: {allowDefaultProject: ['*.ts']},
		tsconfigRootDir: fixturesDirectory,
		...options,
	}),
};

const vueParser = {
	name: 'vue',
	implementation: vueEslintParser,
};

const parsers = Object.fromEntries([
	typescriptParser,
	typescriptTypedParser,
	vueParser,
].map(parser => [parser.name, parser]));

export default parsers;
