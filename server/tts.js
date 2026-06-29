// TTS：Fish Audio 优先；失败 / 无 key 时回退 macOS `say`（中文用 Tingting）
// 合成结果都进 cache/tts/<hash>.<ext>，永久缓存
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, "cache/tts");
const TMP_DIR = path.join(ROOT, "cache/tmp");

const FISH_API = "https://api.fish.audio/v1/tts";
// 一旦命中 402 就标记为不可用，本次进程内不再重试
let fishDisabled = false;

// 用 undici 自己的 fetch + ProxyAgent（与 Node 24 内置 fetch 的接口不一致，必须配套使用）
let _undiciFetch = null;
let _fishDispatcher = null;
async function loadUndici() {
  if (_undiciFetch) return { fetch: _undiciFetch, dispatcher: _fishDispatcher };
  const undici = await import("undici");
  _undiciFetch = undici.fetch;
  const proxy = process.env.UNICO_TTS_PROXY;
  if (proxy) {
    _fishDispatcher = new undici.ProxyAgent(proxy);
    console.log("[tts/fish] via proxy " + proxy);
  }
  return { fetch: _undiciFetch, dispatcher: _fishDispatcher };
}

function hashKey({ provider, voice, text }) {
  return crypto.createHash("sha256")
    .update(`${provider}|${voice}|${text}`)
    .digest("hex").slice(0, 24);
}

function pipeProc(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", d => err += d);
    p.on("error", reject);
    p.on("close", code => code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}: ${err}`)));
  });
}

async function synthFish(text, file, { apiKey, voiceId }) {
  const { fetch, dispatcher } = await loadUndici();
  const resp = await fetch(FISH_API, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text, reference_id: voiceId, format: "mp3", normalize: true, latency: "normal" }),
    ...(dispatcher ? { dispatcher } : {}),
  });
  if (resp.status === 402) {
    fishDisabled = true;
    throw Object.assign(new Error("Fish 402 Insufficient Balance"), { code: 402 });
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Fish TTS ${resp.status}: ${body.slice(0, 200)}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  await fs.writeFile(file, buf);
  return buf.length;
}

async function synthFishWithRetry(text, file, opts) {
  const retries = Number(process.env.FISH_TTS_RETRIES || 2);
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await synthFish(text, file, opts);
    } catch (e) {
      lastErr = e;
      if (e.code === 402) throw e;
      const transient = /fetch failed|UND_ERR|ETIMEDOUT|ECONNRESET|EPIPE|network|timeout/i.test(e.message || "");
      if (!transient || i >= retries) throw e;
      const wait = 450 * Math.pow(2, i) + Math.random() * 250;
      console.warn(`[tts/fish] transient retry ${i + 1}/${retries}，等 ${wait | 0}ms：${e.message}`);
      _undiciFetch = null;
      _fishDispatcher = null;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// macOS `say` → aiff → afconvert → m4a（浏览器原生支持）
async function synthMacSay(text, outFile, { voice = "Tingting" } = {}) {
  await fs.mkdir(TMP_DIR, { recursive: true });
  const aiff = path.join(TMP_DIR, crypto.randomBytes(6).toString("hex") + ".aiff");
  try {
    await pipeProc("say", ["-v", voice, "-o", aiff, text]);
    await pipeProc("afconvert", ["-f", "mp4f", "-d", "aac", aiff, outFile]);
    const stat = await fs.stat(outFile);
    return stat.size;
  } finally {
    try { await fs.unlink(aiff); } catch {}
  }
}

/**
 * @param {string} text
 * @param {object} [opts]
 * @returns {Promise<{url:string, file:string, provider:'fish'|'say', cached:boolean, bytes?:number}>}
 */
export async function synth(text, opts = {}) {
  if (!text || !text.trim()) throw new Error("空文本");
  const apiKey = opts.apiKey || process.env.FISH_API_KEY;
  const voiceId = opts.voiceId || process.env.FISH_VOICE_ID;
  const forceSay = (opts.provider || process.env.TTS_PROVIDER) === "say";
  const canFish = !forceSay && !fishDisabled && apiKey && voiceId;

  await fs.mkdir(CACHE_DIR, { recursive: true });

  // Fish 路径：mp3
  if (canFish) {
    const key = hashKey({ provider: "fish", voice: voiceId, text });
    const file = path.join(CACHE_DIR, `${key}.mp3`);
    const url = `/tts/${key}.mp3`;
    if (existsSync(file)) return { url, file, provider: "fish", cached: true };
    const t0 = Date.now();
    try {
      const bytes = await synthFishWithRetry(text, file, { apiKey, voiceId });
      console.log(`[tts/fish] "${text.slice(0,28)}…" ${((Date.now()-t0)/1000).toFixed(1)}s ${(bytes/1024).toFixed(0)}KB`);
      return { url, file, provider: "fish", cached: false, bytes };
    } catch (e) {
      const detail = e.cause?.code || e.cause?.message || e.code || "";
      console.warn(`[tts/fish] 失败回退 say：${e.message}${detail ? " (" + detail + ")" : ""}`);
      // 网络层错误 → 重置 dispatcher，下次重新建立连接池（防止旧 keepAlive 连接死掉后一直坏）
      if (e.cause?.code || /fetch failed|UND_ERR|ETIMEDOUT|ECONNRESET|EPIPE/i.test(e.message + (detail || ""))) {
        _undiciFetch = null;
        _fishDispatcher = null;
      }
    }
  }

  // say 路径：m4a
  const voice = opts.macVoice || "Tingting";
  const key = hashKey({ provider: "say", voice, text });
  const file = path.join(CACHE_DIR, `${key}.m4a`);
  const url = `/tts/${key}.m4a`;
  if (existsSync(file)) return { url, file, provider: "say", cached: true };
  const t0 = Date.now();
  const bytes = await synthMacSay(text, file, { voice });
  console.log(`[tts/say] "${text.slice(0,28)}…" ${((Date.now()-t0)/1000).toFixed(1)}s ${(bytes/1024).toFixed(0)}KB`);
  return { url, file, provider: "say", cached: false, bytes };
}
