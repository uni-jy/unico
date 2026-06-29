#!/usr/bin/env node
// 从网易云导入：扫码登录 → 拉歌单/最近听歌 → 落 user/playlists.json 草稿
// 用法： node scripts/import-ncm.js
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const ncm = require("NeteaseCloudMusicApi");
const qrcode = require("qrcode-terminal");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const USER_DIR = path.join(ROOT, "user");
const COOKIE_FILE = path.join(DATA_DIR, "ncm-cookie.txt");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(USER_DIR, { recursive: true });
}

async function readCookie() {
  try { return (await fs.readFile(COOKIE_FILE, "utf8")).trim(); }
  catch { return ""; }
}

async function checkExistingLogin(cookie) {
  if (!cookie) return null;
  try {
    const r = await ncm.login_status({ cookie });
    const data = r?.body?.data;
    if (data?.profile?.userId) return { cookie, profile: data.profile };
  } catch {}
  return null;
}

async function qrLogin() {
  console.log("→ 生成登录二维码…");
  const key = (await ncm.login_qr_key({})).body.data.unikey;
  const create = await ncm.login_qr_create({ key, qrimg: true });
  const qrurl = create.body.data.qrurl;
  console.log("");
  qrcode.generate(qrurl, { small: true });
  console.log("\n请用网易云音乐 App 扫码 → 在手机上点'确认登录'");
  console.log("（如果终端二维码扫不出，可手动打开此链接：" + qrurl + "）\n");

  while (true) {
    await sleep(2000);
    const r = await ncm.login_qr_check({ key });
    const code = r.body.code;
    if (code === 800) { process.stdout.write("."); continue; } // 已过期 — 实际是"等待扫码"
    if (code === 801) { process.stdout.write("."); continue; } // 等扫码
    if (code === 802) { process.stdout.write("·"); continue; } // 已扫码，等确认
    if (code === 803) {
      console.log("\n✓ 登录成功");
      const cookie = r.body.cookie;
      await fs.writeFile(COOKIE_FILE, cookie, "utf8");
      const status = await ncm.login_status({ cookie });
      return { cookie, profile: status.body.data.profile };
    }
    console.log("\nQR 状态异常 code=" + code);
    process.exit(1);
  }
}

async function fetchAll(uid, cookie) {
  console.log("→ 拉取歌单列表…");
  // 一次拉前 100 个就够了
  const playlistsResp = await ncm.user_playlist({ uid, limit: 100, cookie });
  const all = playlistsResp.body.playlist || [];
  // 区分 自建（creator.userId == uid）vs 收藏
  const created = all.filter((p) => p.creator?.userId === uid);
  const subscribed = all.filter((p) => p.creator?.userId !== uid);
  console.log(`  自建 ${created.length} 个，收藏 ${subscribed.length} 个`);

  console.log("→ 拉取最近 7 天 / 全部时间 听歌排行…");
  let week = [], all_time = [];
  try { week = (await ncm.user_record({ uid, type: 1, cookie })).body.weekData || []; } catch {}
  try { all_time = (await ncm.user_record({ uid, type: 0, cookie })).body.allData || []; } catch {}
  console.log(`  周榜 ${week.length} 首，总榜 ${all_time.length} 首`);

  console.log("→ 拉取每个自建歌单 top 20…");
  const playlists = [];
  for (const p of created) {
    try {
      const detail = await ncm.playlist_detail({ id: p.id, cookie });
      const allIds = (detail.body.playlist?.trackIds || []).slice(0, 20).map(t => t.id);
      const tracks = (detail.body.playlist?.tracks || []).filter(t => allIds.includes(t.id));
      playlists.push({
        id: p.id,
        name: p.name,
        description: p.description || "",
        trackCount: p.trackCount,
        playCount: p.playCount,
        tags: p.tags || [],
        topTracks: tracks.map(t => ({
          id: t.id,
          title: t.name,
          artist: (t.ar || []).map(a => a.name).join(" / "),
          album: t.al?.name || "",
        })),
      });
      process.stdout.write(".");
    } catch (e) {
      process.stdout.write("x");
    }
    await sleep(120); // 别打太快
  }
  console.log("");

  // 收藏歌单只记元数据（用户没"创作"它们，但订阅本身是信号）
  const subs = subscribed.map(p => ({
    id: p.id, name: p.name, tags: p.tags || [], trackCount: p.trackCount,
    creator: p.creator?.nickname || "",
  }));

  return {
    fetchedAt: new Date().toISOString(),
    week: week.map(w => ({
      title: w.song.name,
      artist: (w.song.ar || []).map(a => a.name).join(" / "),
      playCount: w.playCount, score: w.score,
    })),
    allTime: all_time.map(w => ({
      title: w.song.name,
      artist: (w.song.ar || []).map(a => a.name).join(" / "),
      playCount: w.playCount, score: w.score,
    })),
    created: playlists,
    subscribed: subs,
  };
}

function summarizeForHuman(data, profile) {
  const lines = [];
  lines.push(`# ${profile.nickname} 的网易云数据快照`);
  lines.push(`抓取时间：${data.fetchedAt}\n`);
  lines.push(`## 自建歌单（${data.created.length}）`);
  for (const p of data.created) {
    lines.push(`- **${p.name}** · ${p.trackCount} 首 · ${p.tags.join("/")}${p.description ? " · " + p.description : ""}`);
    for (const t of p.topTracks.slice(0, 8)) {
      lines.push(`  - ${t.title} — ${t.artist}`);
    }
  }
  lines.push(`\n## 收藏的歌单（${data.subscribed.length}）`);
  for (const p of data.subscribed.slice(0, 30)) {
    lines.push(`- ${p.name} · ${p.tags.join("/")} · by ${p.creator}`);
  }
  lines.push(`\n## 最近 7 天 top（${data.week.length}）`);
  for (const t of data.week.slice(0, 30)) lines.push(`- ${t.title} — ${t.artist} (${t.playCount}x)`);
  lines.push(`\n## 全部时间 top（${data.allTime.length}）`);
  for (const t of data.allTime.slice(0, 40)) lines.push(`- ${t.title} — ${t.artist}`);
  return lines.join("\n");
}

async function main() {
  await ensureDirs();
  let session = await checkExistingLogin(await readCookie());
  if (session) console.log(`✓ 复用已存在登录：${session.profile.nickname} (uid=${session.profile.userId})`);
  else session = await qrLogin();

  const data = await fetchAll(session.profile.userId, session.cookie);

  const jsonPath = path.join(USER_DIR, "playlists.json");
  await fs.writeFile(jsonPath, JSON.stringify(data, null, 2), "utf8");
  console.log("✓ 已写：" + jsonPath);

  const mdPath = path.join(USER_DIR, "playlists.md");
  await fs.writeFile(mdPath, summarizeForHuman(data, session.profile), "utf8");
  console.log("✓ 已写：" + mdPath);

  console.log("\n下一步：跑 `node scripts/draft-taste.js` 让 claude 把这堆数据消化成 taste.md 草稿");
}

main().catch((e) => { console.error(e); process.exit(1); });
