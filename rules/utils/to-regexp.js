/**
Compile a user-supplied regular expression string.

The string comes from a config option and is compiled with the `v` flag, so `\p{…}` property escapes and set operations such as `[\p{L}&&\p{Lu}]` work. A pattern the `v` flag rejects is reported as an invalid option.

@param {string} source
@param {string} ruleId
@param {string} optionName
@returns {RegExp}
*/
export default function toRegExp(source, ruleId, optionName) {
	try {
		return new RegExp(source, 'v');
	} catch (error) {
		throw new Error(`Invalid \`${optionName}\` option for \`${ruleId}\`: ${error.message}`, {cause: error});
	}
}
