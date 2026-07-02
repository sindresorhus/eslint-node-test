export {
	isLiteral,
	isStringExpression,
	isBooleanLiteral,
	getStaticStringValue,
	isRegexLiteral,
} from './literal.js';

export {isCallExpression} from './call-or-new-expression.js';

export {default as isExpressionStatement} from './is-expression-statement.js';
export {default as isFunction} from './is-function.js';
export {default as isLoop} from './is-loop.js';
export {default as isMemberExpression} from './is-member-expression.js';
export {default as isMethodCall} from './is-method-call.js';
export {default as functionTypes} from './function-types.js';
export {default as loopTypes} from './loop-types.js';
