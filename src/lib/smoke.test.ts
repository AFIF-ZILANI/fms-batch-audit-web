import assert from "node:assert/strict"
import { test } from "node:test"

// Smoke test so `npm test` has something to run; real tests live next to the code they cover (`*.test.ts`).
// Import project code with relative paths and the .ts extension (node strips types; "@/" aliases don't resolve).
test("test runner works", () => assert.equal(1 + 1, 2))
