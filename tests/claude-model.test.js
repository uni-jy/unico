import test from "node:test";
import assert from "node:assert/strict";

test("Claude CLI wrapper defaults to deepseek-v4-pro", async () => {
  const mod = await import("../server/claude.js");
  assert.equal(mod.MODEL, "deepseek-v4-pro");
});
