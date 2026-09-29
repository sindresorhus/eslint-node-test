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
	// The cases name a file inside this directory, which the `tsconfig.json` next to it covers, so the project service reads real declarations from it. `allowDefaultProject` would instead serve the file from an inferred project with no `strict` setting and no `@types/node`, which makes every type-aware case pass for the wrong reason.
	mergeParserOptions: options => ({
		projectService: {allowDefaultProject: []},
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
