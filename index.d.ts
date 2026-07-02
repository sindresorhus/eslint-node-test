import type {ESLint, Linter} from 'eslint';

declare const eslintNodeTest: ESLint.Plugin & {
	configs: {
		recommended: Linter.Config;
		unopinionated: Linter.Config;
		all: Linter.Config;
	};
};

export default eslintNodeTest;
