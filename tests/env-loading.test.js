import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("_env loads without a local .env file", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "unico-env-"));
  const script = "import('/Users/duiba1/Desktop/claudio/server/_env.js').then(()=>console.log('ok'))";
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd,
    encoding: "utf8",
  });

  assert.match(out, /ok/);
});
