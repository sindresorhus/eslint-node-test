const CHARACTER_ESCAPES = {
	'\n': String.raw`\n`,
	'\r': String.raw`\r`,
	'\t': String.raw`\t`,
	'\b': String.raw`\b`,
	'\f': String.raw`\f`,
	'\v': String.raw`\v`,
	'\0': String.raw`\0`,
};

function isUnsafeCharacter(codePoint) {
	return codePoint <= 0x1F // C0 control characters.
		|| codePoint === 0x7F // DEL.
		// U+2028 and U+2029 are line terminators. Left unescaped, they're a syntax error inside a
		// single/double-quoted string literal (only template literals may contain them raw).
		|| codePoint === 0x20_28
		|| codePoint === 0x20_29;
}

/**
Escape string and wrap the result in quotes.

@param {string} string - The string to be quoted.
@param {string} [quote] - The quote character.
@returns {string} - The quoted and escaped string.
*/
export default function escapeString(string, quote = '\'') {
	/* c8 ignore start */
	if (typeof string !== 'string') {
		throw new TypeError('Unexpected string.');
	}
	/* c8 ignore end */

	const escaped = [...string].map(character => {
		if (character === '\\') {
			return String.raw`\\`;
		}

		if (character === quote) {
			return `\\${quote}`;
		}

		const codePoint = character.codePointAt(0);
		if (isUnsafeCharacter(codePoint)) {
			return CHARACTER_ESCAPES[character] ?? String.raw`\u${codePoint.toString(16).padStart(4, '0')}`;
		}

		return character;
	}).join('');

	return `${quote}${escaped}${quote}`;
}
