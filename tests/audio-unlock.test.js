import test from "node:test";
import assert from "node:assert/strict";
import { unlockAudioElement } from "../pwa/src/audio-unlock.js";

test("unlockAudioElement primes an audio element with a silent clip", async () => {
  const calls = [];
  const audio = {
    src: "",
    muted: false,
    volume: 1,
    async play() {
      calls.push(["play", this.src, this.muted, this.volume]);
    },
    pause() {
      calls.push(["pause"]);
    },
    removeAttribute(name) {
      calls.push(["removeAttribute", name]);
      if (name === "src") this.src = "";
    },
  };

  const ok = await unlockAudioElement(audio);

  assert.equal(ok, true);
  assert.match(calls[0][1], /^data:audio\/wav;base64,/);
  assert.equal(calls[0][2], true);
  assert.equal(audio.src, "");
  assert.equal(audio.muted, false);
  assert.equal(audio.volume, 1);
});

test("unlockAudioElement restores audio state when play is blocked", async () => {
  const audio = {
    src: "/tts/existing.mp3",
    muted: false,
    volume: 0.8,
    async play() {
      throw Object.assign(new Error("NotAllowedError"), { name: "NotAllowedError" });
    },
    pause() {},
    removeAttribute(name) {
      if (name === "src") this.src = "";
    },
  };

  const ok = await unlockAudioElement(audio);

  assert.equal(ok, false);
  assert.equal(audio.src, "/tts/existing.mp3");
  assert.equal(audio.muted, false);
  assert.equal(audio.volume, 0.8);
});
