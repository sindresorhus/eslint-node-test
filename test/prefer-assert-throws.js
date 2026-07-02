import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const ASSERT_IMPORT = 'import assert from \'node:assert\';';
const TEST_AND_ASSERT = 'import test from \'node:test\';\nimport assert from \'node:assert\';';

test.snapshot({
	valid: [
		// Not an assert file
		'try { fn(); } catch (err) { console.log(err); }',

		// Try/catch with no assertion in catch
		`${ASSERT_IMPORT}\ntry { fn(); } catch (err) { console.log(err); }`,

		// Try with only a finally (no catch)
		`${ASSERT_IMPORT}\ntry { fn(); } finally { cleanup(); }`,

		// Empty try block — nothing to wrap
		`${ASSERT_IMPORT}\ntry {} catch (err) { assert.ok(err instanceof Error); }`,

		// Assert.throws is already used — valid
		`${ASSERT_IMPORT}\nassert.throws(() => fn());`,
		`${ASSERT_IMPORT}\nawait assert.rejects(() => fn());`,

		// Try/catch where catch has no assertion (only logging)
		`${ASSERT_IMPORT}\ntry { fn(); } catch (err) { err.message; }`,

		// Intentionally unsupported: bare assert(false) in try body (no assertion in catch)
		`${ASSERT_IMPORT}\ntry { assert.ok(false); } catch (err) {}`,

		// `assert.fail()` in catch asserts the try body should NOT throw — opposite of `assert.throws()`
		`${ASSERT_IMPORT}\ntry {\n\tfn();\n} catch (err) {\n\tassert.fail('should not throw');\n}`,

		// Named-import `fail()` in catch — same exclusion
		'import {fail} from \'node:assert\';\ntry {\n\tfn();\n} catch (err) {\n\tfail();\n}',
	],
	invalid: [
		// Basic sync: try with assertion in catch
		`${ASSERT_IMPORT}\ntry {\n\tfn();\n} catch (err) {\n\tassert.ok(err instanceof Error);\n}`,

		// Basic sync: assert.strictEqual in catch
		`${ASSERT_IMPORT}\ntry {\n\tfn();\n} catch (err) {\n\tassert.strictEqual(err.message, 'boom');\n}`,

		// Multiple statements in try body
		`${ASSERT_IMPORT}\ntry {\n\tconst x = setup();\n\tthrowingFn(x);\n} catch (err) {\n\tassert.ok(err);\n}`,

		// Async: try with await in body and assertion in catch
		`${ASSERT_IMPORT}\ntry {\n\tawait fetchData();\n} catch (err) {\n\tassert.ok(err instanceof Error);\n}`,

		// Async via `for await` in body — also reported as `assert.rejects`
		`${ASSERT_IMPORT}\ntry {\n\tfor await (const x of stream) { use(x); }\n} catch (err) {\n\tassert.ok(err instanceof Error);\n}`,

		// `catch` and `finally` together — still reported
		`${ASSERT_IMPORT}\ntry {\n\tfn();\n} catch (err) {\n\tassert.ok(err);\n} finally {\n\tcleanup();\n}`,

		// Named import
		'import {ok} from \'node:assert\';\ntry {\n\tfn();\n} catch (err) {\n\tok(err instanceof Error);\n}',

		// T.assert in catch
		`${TEST_AND_ASSERT}\ntest('t', t => {\n\ttry {\n\t\tfn();\n\t} catch (err) {\n\t\tt.assert.ok(err);\n\t}\n});`,

		// Multiple assertions in catch
		`${ASSERT_IMPORT}\ntry {\n\tfn();\n} catch (err) {\n\tassert.ok(err instanceof TypeError);\n\tassert.strictEqual(err.message, 'boom');\n}`,

		// Assertion nested deeper inside catch
		`${ASSERT_IMPORT}\ntry {\n\tfn();\n} catch (err) {\n\tif (err) {\n\t\tassert.ok(err);\n\t}\n}`,

		// TypeScript
		{
			code: `${ASSERT_IMPORT}\ntry {\n\tfn();\n} catch (err) {\n\tassert.ok((err as Error).message);\n}`,
			languageOptions: {parser: parsers.typescript},
		},
	],
});
