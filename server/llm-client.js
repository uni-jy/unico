const DEFAULT_MODEL = "deepseek-v4-pro";
const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";

export function getLLMConfig(env = process.env) {
  const apiKey = env.DEEPSEEK_API_KEY ||
    env.OPENAI_API_KEY ||
    env.ANTHROPIC_API_KEY ||
    env.ANTHROPIC_AUTH_TOKEN ||
    "";
  const baseUrl = (env.DEEPSEEK_BASE_URL ||
    env.OPENAI_BASE_URL ||
    env.ANTHROPIC_BASE_URL ||
    DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = env.UNICO_MODEL || DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
}

export function buildChatRequest({
  system = "",
  user = "",
  stream = false,
  temperature = 0.8,
  config = getLLMConfig(),
} = {}) {
  if (!config.apiKey) {
    throw new Error("LLM API key 未配置：请设置 DEEPSEEK_API_KEY（或 OPENAI_API_KEY / ANTHROPIC_API_KEY 兼容中转）");
  }
  const body = {
    model: config.model,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: user },
    ],
    stream,
    temperature,
  };
  return {
    url: `${config.baseUrl}/chat/completions`,
    options: {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  };
}

export function parseChatCompletion(json) {
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("LLM 返回为空");
  }
  return text;
}

export function parseSSEDelta(text) {
  const out = [];
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const evt = JSON.parse(data);
      const delta = evt?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) out.push(delta);
    } catch {}
  }
  return out;
}

export async function completeChat({ system, user, timeoutMs = 180_000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("llm timeout")), timeoutMs);
  try {
    const req = buildChatRequest({ system, user, stream: false });
    const resp = await fetchImpl(req.url, { ...req.options, signal: controller.signal });
    const body = await resp.text();
    if (!resp.ok) throw new Error(`LLM HTTP ${resp.status}: ${body.slice(0, 300)}`);
    return parseChatCompletion(JSON.parse(body));
  } finally {
    clearTimeout(timer);
  }
}

export async function streamChat({
  system,
  user,
  onDelta,
  timeoutMs = 90_000,
  signal,
  fetchImpl = fetch,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("llm stream timeout")), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  try {
    const req = buildChatRequest({ system, user, stream: true });
    const resp = await fetchImpl(req.url, { ...req.options, signal: controller.signal });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`LLM stream HTTP ${resp.status}: ${body.slice(0, 300)}`);
    }
    if (!resp.body) {
      const body = await resp.text();
      const parts = parseSSEDelta(body);
      const full = parts.join("");
      for (const part of parts) onDelta?.(part, full);
      return full;
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const delta of parseSSEDelta(text)) {
        full += delta;
        onDelta?.(delta, full);
      }
    }
    if (!full.trim()) throw new Error("LLM 流式输出为空");
    return full.trim();
  } finally {
    clearTimeout(timer);
  }
}
