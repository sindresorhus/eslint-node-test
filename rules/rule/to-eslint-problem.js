import toEslintFixer from './to-eslint-rule-fixer.js';
import {iterateFixOrProblems} from './utilities.js';

/**
@import * as ESLint from 'eslint';
*/

/**
@typedef {Parameters<ESLint.Rule.RuleContext['report']>[0]} EslintProblem
@typedef {EslintProblem} UnicornProblem
@typedef {EslintProblem | undefined | EslintProblem[] | IterableIterator<EslintProblem>} UnicornProblems
*/

/**
@param {UnicornProblem} unicornProblem
@returns {EslintProblem}
*/
export default function toEslintProblem(unicornProblem) {
	const eslintProblem = {...unicornProblem};

	if (unicornProblem.fix) {
		eslintProblem.fix = toEslintFixer(unicornProblem.fix);
	}

	// Anything iterable, the same as the fix path: a generator defers its body, and ESLint drops a
	// `suggest` it cannot read without saying so.
	if (unicornProblem.suggest) {
		// A suggestion without a fix is dropped, the way ESLint drops one it cannot apply.
		eslintProblem.suggest = [...iterateFixOrProblems(unicornProblem.suggest)]
			.filter(unicornSuggest => typeof unicornSuggest.fix === 'function')
			.map(unicornSuggest => ({
				...unicornSuggest,
				fix: toEslintFixer(unicornSuggest.fix),
				data: {
					...unicornProblem.data,
					...unicornSuggest.data,
				},
			}));
	}

	return eslintProblem;
}
