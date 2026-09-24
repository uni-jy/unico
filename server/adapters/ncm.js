// NeteaseCloudMusicApi 适配器 —— 直接 require 函数，不另起 HTTP 服务
// music.163.com 偶尔 ECONNRESET，全部走重试包装
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../paths.js";
const require = createRequire(import.meta.url);
const ncm = require("NeteaseCloudMusicApi");

const COOKIE_PATH = path.join(DATA_DIR, "ncm-cookie.txt");
let _cookie = "";
try { _cookie = fs.readFileSync(COOKIE_PATH, "utf8").trim(); } catch {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NCM_RETRIES = Number(process.env.NCM_RETRIES || 2);

function normForMatch(s = "") {
  return String(s || "")
    .toLowerCase()
    .replace(/（[^）]*）|\([^)]*\)|\[[^\]]*\]|【[^】]*】/g, " ")
    .replace(/[《》"'“”‘’·.,，。:：;；!?！？/\\|_+~～\-—–－]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactForMatch(s = "") {
  return normForMatch(s).replace(/\s+/g, "");
}

function splitQuery(keyword = "") {
  const raw = String(keyword || "").trim();
  const m = raw.match(/^(.+?)\s*[-—–－]\s*(.+)$/);
  if (!m) return { title: raw, artist: "" };
  return { title: m[1].trim(), artist: m[2].trim() };
}

function bareArtistForExact(s = "") {
  return String(s || "")
    .toLowerCase()
    .replace(/（[^）]*）|\([^)]*\)|\[[^\]]*\]|【[^】]*】/g, "")
    .replace(/["“”‘’·，。:：;；!?！？\s]/g, "")
    .trim();
}

function hasExactArtist(keyword, hit) {
  const q = splitQuery(keyword);
  if (!q.artist) return false;
  const want = bareArtistForExact(q.artist);
  return String(hit.artist || "")
    .split("/")
    .some((part) => bareArtistForExact(part) === want);
}

function containsEither(a, b) {
  const aa = compactForMatch(a);
  const bb = compactForMatch(b);
  if (!aa || !bb) return false;
  if (aa.length < 2 || bb.length < 2) return false;
  return aa.includes(bb) || bb.includes(aa);
}

function likelyQueryMatch(keyword, hit, { titleOnly = false } = {}) {
  const q = splitQuery(keyword);
  const titleOk = containsEither(q.title, hit.title);
  if (!titleOk) return false;
  if (titleOnly) return true;
  if (!q.artist) return true;
  return containsEither(q.artist, hit.artist);
}

async function withRetry(fn, label, retries = NCM_RETRIES) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const status = e?.status;
      const code = e?.body?.code;
      if (status !== 502 && code !== 502 && e?.code !== "ECONNRESET") throw e;
      const wait = 300 * Math.pow(2, i) + Math.random() * 200;
      console.warn(`[ncm] ${label} 重试 ${i + 1}/${retries}，等 ${wait | 0}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

const baseOpts = (cookie) => {
  const c = String(cookie || _cookie || "").trim();
  return c ? { cookie: c } : {};
};

export async function search(keyword, limit = 5, opts = {}) {
  const r = await withRetry(() => ncm.cloudsearch({ keywords: keyword, limit, ...baseOpts(opts.cookie) }), `search "${keyword}"`);
  const songs = r?.body?.result?.songs || [];
  return songs.map((s) => ({
    id: String(s.id),
    title: s.name,
    artist: (s.ar || []).map((a) => a.name).join(" / "),
    album: s.al?.name || "",
    duration: s.dt || 0,
    picUrl: s.al?.picUrl || "",
  }));
}

export async function songUrl(id, opts = {}) {
  const levels = opts.levels || ["exhigh", "higher", "standard"];
  for (const level of levels) {
    const r = await withRetry(() => ncm.song_url_v1({ id, level, ...baseOpts(opts.cookie) }), `song_url ${id}/${level}`);
    const item = r?.body?.data?.[0];
    if (!item || !item.url) continue;
    // VIP 歌曲对无权限账号会返回 30s 试听片段（freeTrialInfo 非空）。拒掉，继续尝试其它候选。
    if (item.freeTrialInfo) {
      console.warn(`[ncm] 跳过 VIP 试听：song ${id} level=${level}`);
      continue;
    }
    return item.url;
  }
  return null;
}

export async function lyric(id, opts = {}) {
  const r = await withRetry(() => ncm.lyric({ id, ...baseOpts(opts.cookie) }), `lyric ${id}`);
  return r?.body?.lrc?.lyric || "";
}

/** 一步到位：关键词 → 首条可播曲目（含直链）。找不到返回 null */
export async function resolveOne(keyword, { strict = false, titleOnly = false, cookie = "" } = {}) {
  const hits = await search(keyword, 8, { cookie });
  let candidates = strict || titleOnly
    ? hits.filter((h) => likelyQueryMatch(keyword, h, { titleOnly }))
    : hits;
  const query = splitQuery(keyword);
  if (strict && query.artist) {
    const exactArtistCandidates = candidates.filter((h) => hasExactArtist(keyword, h));
    if (exactArtistCandidates.length) candidates = exactArtistCandidates;
  }
  for (const h of candidates) {
    let url = null;
    try {
      url = await songUrl(h.id, { cookie });
    } catch (e) {
      console.warn(`[ncm] 候选不可用，继续找下一首：${h.title} — ${h.artist} (${e.message || e.body?.msg || e.status || "unknown"})`);
      continue;
    }
    if (url) return { ...h, url, source: "ncm" };
  }
  return null;
}
