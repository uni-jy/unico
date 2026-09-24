import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("tenant data is created under UNICO_RUNTIME_ROOT when configured", async () => {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "unico-runtime-"));
  const uid = `test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const previousRuntimeRoot = process.env.UNICO_RUNTIME_ROOT;
  process.env.UNICO_RUNTIME_ROOT = runtimeRoot;

  let tenantDir = "";
  try {
    const { getTenant } = await import(`../server/tenant.js?runtime=${encodeURIComponent(uid)}`);
    const tenant = getTenant(uid);
    tenantDir = tenant.dir;

    assert.equal(tenant.dir, path.join(runtimeRoot, "data", "users", uid));
    assert.ok(fs.existsSync(tenant.dir));
  } finally {
    if (previousRuntimeRoot === undefined) delete process.env.UNICO_RUNTIME_ROOT;
    else process.env.UNICO_RUNTIME_ROOT = previousRuntimeRoot;

    if (tenantDir) fs.rmSync(tenantDir, { recursive: true, force: true });
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
});
