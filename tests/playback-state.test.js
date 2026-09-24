import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadPlaybackState,
  savePlaybackState,
  sanitizePlaybackState,
} from "../server/playback-state.js";

function tempTenantDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "unico-playback-"));
}

test("sanitizePlaybackState keeps only compact resumable playback fields", () => {
  const state = sanitizePlaybackState({
    started: true,
    paused: false,
    progressSeconds: 72.9,
    updatedAt: "client value",
    currentTrack: {
      id: "song-1",
      title: "深蓝",
      artist: "陈婧霏",
      url: "https://example.test/audio.mp3",
      picUrl: "https://example.test/cover.jpg",
      source: "ncm",
      unexpected: "drop me",
    },
    queue: [
      { title: "未来俱乐部", artist: "声音玩具", url: "https://example.test/2.mp3", reason: "next" },
      null,
      { title: "", artist: "No Title" },
    ],
    extra: "drop me too",
  });

  assert.equal(state.started, true);
  assert.equal(state.paused, false);
  assert.equal(state.progressSeconds, 72);
  assert.match(state.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(Object.keys(state.currentTrack).sort(), [
    "artist",
    "duration",
    "exploration",
    "id",
    "picUrl",
    "reason",
    "source",
    "title",
    "url",
  ].sort());
  assert.equal(state.currentTrack.title, "深蓝");
  assert.equal(state.queue.length, 1);
  assert.equal(state.queue[0].title, "未来俱乐部");
});

test("savePlaybackState writes tenant-local state and loadPlaybackState reads it", () => {
  const dir = tempTenantDir();
  const tenant = { playbackStatePath: path.join(dir, "playback-state.json") };

  const saved = savePlaybackState(tenant, {
    started: true,
    paused: true,
    progressSeconds: 15,
    currentTrack: { title: "南方", artist: "达达乐队", url: "/proxy/audio?u=x", source: "ncm" },
    queue: [{ title: "雨", artist: "甜梅号", url: "/proxy/audio?u=y" }],
  });

  const loaded = loadPlaybackState(tenant);
  assert.deepEqual(loaded, saved);
  assert.equal(JSON.parse(fs.readFileSync(tenant.playbackStatePath, "utf8")).currentTrack.title, "南方");
});
