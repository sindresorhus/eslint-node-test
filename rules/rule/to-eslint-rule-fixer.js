import {iterateFixOrProblems} from './utilities.js';

/**
@import * as ESLint from 'eslint';
*/

class FixAbortError extends Error {
	name = 'FixAbortError';
}

const fixOptions = {
	abort() {
		throw new FixAbortError('Fix aborted.');
	},
};

/**
@typedef {ESLint.Rule.ReportFixer | undefined} EslintReportFixer
@typedef {EslintReportFixer | IterableIterator<EslintReportFixer>} UnicornReportFixer
@typedef {(fixer: ESLint.Rule.RuleFixer, options: typeof fixOptions) => UnicornReportFixer} UnicornRuleFixer
*/

/**
Convert Unicorn style fix function to ESLint style fix function

@param {UnicornRuleFixer} fix
@returns {ESLint.Rule.RuleFixer}
*/
export default function toEslintRuleFixer(fix) {
	/** @param {UnicornReportFixer} fixer */
	return fixer => {
		// A generator defers its body until iteration, so the call is inside the `try` either way:
		// a plain function that calls `abort()` throws here, and that has to mean "no fix" too.
		try {
			const unicornReport = fix(fixer, fixOptions);

			return [...iterateFixOrProblems(unicornReport)];
		} catch (error) {
			if (error instanceof FixAbortError) {
				return;
			}

			/* c8 ignore next */
			throw error;
		}
	};
}
