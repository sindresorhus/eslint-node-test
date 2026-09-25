/**
Compile a user-supplied regular expression string.

The string comes from a config option, so it is a plain JavaScript regex the way
`/…/` would be. A unicode flag is tried first because it is what makes `\p{…}`
property escapes work, but it is stricter than a bare regex: it rejects identity
escapes such as `\_`, `\#`, `\@` and `\,`, which are common in filename and title
patterns. Falling back to an unflagged pattern keeps those working, and only a
pattern that neither form accepts is reported as invalid.

@param {string} source
@param {string} ruleId
@param {string} optionName
@returns {RegExp}
*/
export default function toRegExp(source, ruleId, optionName) {
	try {
		return new RegExp(source, 'u');
	} catch (unicodeError) {
		try {
			return new RegExp(source);
		} catch {
			throw new Error(`Invalid \`${optionName}\` option for \`${ruleId}\`: ${unicodeError.message}`, {cause: unicodeError});
		}
	}
}
