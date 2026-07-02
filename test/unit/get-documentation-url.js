import url from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import getDocumentationUrl from '../../rules/utils/get-documentation-url.js';
import packageJson from '../../package.json' with {type: 'json'};

const filename = url.fileURLToPath(import.meta.url);

test('returns the URL of a named rule\'s documentation', () => {
	const url = `https://github.com/sindresorhus/eslint-node-test/blob/v${packageJson.version}/docs/rules/foo.md`;
	assert.strictEqual(getDocumentationUrl('foo.js'), url);
});

test('determines the rule name from the file', () => {
	const url = `https://github.com/sindresorhus/eslint-node-test/blob/v${packageJson.version}/docs/rules/get-documentation-url.md`;
	assert.strictEqual(getDocumentationUrl(filename), url);
});
