import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPopoutFeatures,
  getInitialWindowMode,
  setWindowModePreference,
  buildWindowUrl,
} from "../pwa/src/window-mode.js";

test("getInitialWindowMode enables compact mode from query or saved preference", () => {
  const storage = new Map();
  assert.equal(getInitialWindowMode("?window=1", storage), true);
  assert.equal(getInitialWindowMode("?window=0", storage), false);

  setWindowModePreference(true, storage);
  assert.equal(getInitialWindowMode("", storage), true);

  setWindowModePreference(false, storage);
  assert.equal(getInitialWindowMode("", storage), false);
});

test("buildWindowUrl adds window=1 without losing existing query params", () => {
  assert.equal(
    buildWindowUrl("http://localhost:8080/?scene=onair"),
    "http://localhost:8080/?scene=onair&window=1"
  );
});

test("buildPopoutFeatures creates a compact standalone window feature string", () => {
  const features = buildPopoutFeatures({ width: 420, height: 640, left: 80, top: 60 });
  assert.equal(features, "popup=yes,width=420,height=640,left=80,top=60,resizable=yes,scrollbars=no");
});
