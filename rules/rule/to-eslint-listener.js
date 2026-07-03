import toEslintProblem from './to-eslint-problem.js';

/**
@import * as ESLint from 'eslint';
@import {UnicornContext} from './unicorn-context.js'
@import {UnicornProblems} from './to-eslint-problem.js'
*/

/**
@typedef {ESLint.Rule.RuleListener} EslintListers
@typedef {keyof EslintListers} ListenerType
@typedef {EslintListers[ListenerType]} EslintListener
@typedef {(...listenerArguments: Parameters<EslintListener>) => UnicornProblems} UnicornRuleListen
*/

/**
Report a listener's return value: `undefined` (the common case), a single problem object, or an array/iterable of problems (possibly nested). Kept generator-free — this runs for every visited node of every rule, and the overwhelming majority of calls report nothing.

@param {ESLint.Rule.RuleContext} context
@param {UnicornProblems} problems
*/
function reportProblems(context, problems) {
	if (!problems) {
		return;
	}

	// A single problem object is a plain object (not iterable), so report it directly.
	if (typeof problems[Symbol.iterator] !== 'function') {
		context.report(toEslintProblem(problems));
		return;
	}

	for (const problem of problems) {
		reportProblems(context, problem);
	}
}

/**
@param {UnicornContext} context
@param {UnicornRuleListen[]} listeners
@returns {EslintListener}
*/
export default function toEslintListener(context, listeners) {
	// Forward positional arguments explicitly instead of a rest array, since this runs for every
	// visited node and a rest/spread would allocate on each call. ESLint passes at most three
	// arguments to a listener (`onCodePathSegmentLoop`); node listeners get a single `node`.
	return (argument0, argument1, argument2) => {
		for (const listener of listeners) {
			reportProblems(context, listener(argument0, argument1, argument2));
		}
	};
}
