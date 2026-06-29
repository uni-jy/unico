import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChatRequest,
  getLLMConfig,
  parseChatCompletion,
  parseSSEDelta,
} from "../server/llm-client.js";

test("getLLMConfig prefers DeepSeek env and defaults to deepseek-v4-pro", () => {
  const env = {
    DEEPSEEK_API_KEY: "ds-key",
    DEEPSEEK_BASE_URL: "https://relay.example/v1",
  };
  assert.deepEqual(getLLMConfig(env), {
    apiKey: "ds-key",
    baseUrl: "https://relay.example/v1",
    model: "deepseek-v4-pro",
  });
});

test("getLLMConfig accepts OpenAI-compatible fallback env", () => {
  const env = {
    OPENAI_API_KEY: "openai-compatible-key",
    OPENAI_BASE_URL: "https://openai-compatible.example/v1/",
    UNICO_MODEL: "deepseek-v4-pro",
  };
  assert.deepEqual(getLLMConfig(env), {
    apiKey: "openai-compatible-key",
    baseUrl: "https://openai-compatible.example/v1",
    model: "deepseek-v4-pro",
  });
});

test("buildChatRequest creates OpenAI-compatible chat completion request", () => {
  const req = buildChatRequest({
    system: "system text",
    user: "user text",
    stream: false,
    config: { apiKey: "key", baseUrl: "https://relay.example/v1", model: "deepseek-v4-pro" },
  });
  assert.equal(req.url, "https://relay.example/v1/chat/completions");
  assert.equal(req.options.method, "POST");
  assert.equal(req.options.headers.Authorization, "Bearer key");
  assert.equal(req.options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(req.options.body), {
    model: "deepseek-v4-pro",
    messages: [
      { role: "system", content: "system text" },
      { role: "user", content: "user text" },
    ],
    stream: false,
    temperature: 0.8,
  });
});

test("parseChatCompletion returns assistant content", () => {
  const text = parseChatCompletion({
    choices: [{ message: { content: "{\"ok\":true}" } }],
  });
  assert.equal(text, "{\"ok\":true}");
});

test("parseSSEDelta extracts streaming content deltas", () => {
  const chunks = parseSSEDelta([
    "data: {\"choices\":[{\"delta\":{\"content\":\"你\"}}]}",
    "data: {\"choices\":[{\"delta\":{\"content\":\"好\"}}]}",
    "data: [DONE]",
  ].join("\n\n"));
  assert.deepEqual(chunks, ["你", "好"]);
});
