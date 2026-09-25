// The file the type-aware test cases name as their `filename`. It is never linted itself: the
// project service only needs it to exist so that `tsconfig.json` in this directory covers it, which is
// what gives those cases real type information (including `node:test`'s own types) instead of an
// inferred project with no declarations at all.
export {};
