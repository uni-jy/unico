import test from "node:test";
import assert from "node:assert/strict";
import { createBufferedSender } from "../pwa/src/ws-send.js";

test("buffered sender queues messages until websocket opens", () => {
  const sent = [];
  const sender = createBufferedSender(() => null);

  sender.send({ type: "claim" });
  sender.send({ type: "control", action: "start-radio" });
  assert.equal(sender.pendingCount(), 2);

  sender.setSocket({
    readyState: 1,
    send: (msg) => sent.push(JSON.parse(msg)),
  });

  assert.deepEqual(sent, [
    { type: "claim" },
    { type: "control", action: "start-radio" },
  ]);
  assert.equal(sender.pendingCount(), 0);
});

test("buffered sender sends immediately when websocket is open", () => {
  const sent = [];
  const socket = { readyState: 1, send: (msg) => sent.push(JSON.parse(msg)) };
  const sender = createBufferedSender(() => socket);

  sender.send({ type: "ping" });

  assert.deepEqual(sent, [{ type: "ping" }]);
  assert.equal(sender.pendingCount(), 0);
});
