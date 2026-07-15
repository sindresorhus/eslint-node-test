# no-mock-timers-destructured-import

📝 Disallow destructured timer imports when using `mock.timers`.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`mock.timers` works by replacing the timer functions on the global object (and the `node:timers` module). A destructured import such as `import {setTimeout} from 'node:timers'` captures the *original* function at import time, so the local binding keeps pointing at the real timer even after `mock.timers.enable()`. Calls through it are never intercepted, and `mock.timers.tick()` appears to do nothing. The [Node.js docs](https://nodejs.org/api/test.html#class-mocktimers) note that destructured imports are not supported.

This rule reports a destructured timer import (`setTimeout`, `setInterval`, `setImmediate`, and their `clear*` counterparts) from `node:timers` when the file enables the matching API via `mock.timers.enable()`. Call the global function instead.

## Examples

```js
import {test, mock} from 'node:test';
import {setTimeout} from 'node:timers'; // ❌ captured before the mock is installed

test('debounce', () => {
	mock.timers.enable({
		apis: [
			'setTimeout'
		]
	});
	setTimeout(fn, 1000); // real timer — not mocked
	mock.timers.tick(1000); // does nothing
});
```

```js
import {test, mock} from 'node:test';

// ✅ the global `setTimeout` is intercepted by the mock
test('debounce', () => {
	mock.timers.enable({
		apis: [
			'setTimeout'
		]
	});
	setTimeout(fn, 1000);
	mock.timers.tick(1000);
});
```

Only ESM `import` is checked. A CommonJS `const {setTimeout} = require('node:timers')` has the same problem but is not detected.
