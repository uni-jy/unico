import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTtsStorage } from "../server/tts-storage.js";

test("persistTtsFile stores generated audio under a private tts blob path", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "unico-tts-"));
  const file = path.join(dir, "sample.mp3");
  fs.writeFileSync(file, Buffer.from("mp3-data"));
  const puts = [];

  try {
    const storage = createTtsStorage({
      enabled: true,
      put: async (pathname, body, options) => {
        puts.push({ pathname, body: Buffer.from(body), options });
        return { pathname };
      },
    });

    const result = await storage.persistTtsFile("sample.mp3", file);

    assert.equal(result.enabled, true);
    assert.equal(result.stored, true);
    assert.equal(puts[0].pathname, "tts/sample.mp3");
    assert.equal(puts[0].body.toString(), "mp3-data");
    assert.equal(puts[0].options.access, "private");
    assert.equal(puts[0].options.contentType, "audio/mpeg");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readTtsFile returns audio bytes from blob storage", async () => {
  const storage = createTtsStorage({
    enabled: true,
    get: async (pathname, options) => {
      assert.equal(pathname, "tts/sample.mp3");
      assert.equal(options.access, "private");
      return {
        statusCode: 200,
        stream: new Response(Buffer.from("mp3-data")).body,
      };
    },
  });

  const result = await storage.readTtsFile("sample.mp3");

  assert.equal(result.contentType, "audio/mpeg");
  assert.equal(result.buffer.toString(), "mp3-data");
});

test("tts storage rejects unsafe blob names", async () => {
  const storage = createTtsStorage({
    enabled: true,
    get: async () => assert.fail("unsafe names should not reach blob get"),
    put: async () => assert.fail("unsafe names should not reach blob put"),
  });

  assert.equal(await storage.readTtsFile("../sample.mp3"), null);
  assert.equal((await storage.persistTtsFile("../sample.mp3", "/tmp/nope")).stored, false);
});
