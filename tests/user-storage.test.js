import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("hydrateUserFiles restores persisted user files into an empty runtime directory", async () => {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "unico-storage-"));
  const previousRuntimeRoot = process.env.UNICO_RUNTIME_ROOT;
  const uid = `user-${Date.now()}`;
  process.env.UNICO_RUNTIME_ROOT = runtimeRoot;

  const remoteFiles = new Map([
    [`users/${uid}/taste.md`, "# 你的听觉肖像\n\n" + "喜欢摇滚。".repeat(30)],
    [`users/${uid}/playlists.json`, JSON.stringify({ created: [], subscribed: [], week: [], allTime: [] })],
  ]);

  try {
    const { createUserStorage } = await import(`../server/user-storage.js?case=${Date.now()}`);
    const storage = createUserStorage({
      enabled: true,
      list: async ({ prefix }) => ({
        blobs: [...remoteFiles.keys()]
          .filter((pathname) => pathname.startsWith(prefix))
          .map((pathname) => ({ pathname, url: `memory://${pathname}` })),
      }),
      get: null,
      fetcher: async (url) => ({
        ok: true,
        text: async () => remoteFiles.get(String(url).replace("memory://", "")),
      }),
    });

    await storage.hydrateUserFiles(uid);

    const userDir = path.join(runtimeRoot, "data", "users", uid);
    assert.match(fs.readFileSync(path.join(userDir, "taste.md"), "utf8"), /^# 你的听觉肖像/);
    assert.equal(fs.readFileSync(path.join(userDir, "playlists.json"), "utf8"), remoteFiles.get(`users/${uid}/playlists.json`));
  } finally {
    if (previousRuntimeRoot === undefined) delete process.env.UNICO_RUNTIME_ROOT;
    else process.env.UNICO_RUNTIME_ROOT = previousRuntimeRoot;
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
});
