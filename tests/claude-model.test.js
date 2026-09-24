import test from "node:test";
import assert from "node:assert/strict";

test("LLM wrapper defaults to Seed 2.1 Pro", async () => {
  const mod = await import("../server/claude.js");
  assert.equal(mod.MODEL, "doubao-seed-2-1-pro-260915");
});
