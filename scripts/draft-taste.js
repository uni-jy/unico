#!/usr/bin/env node
// 把 user/playlists.json 压缩成精简侧写 → 交给 claude 写 user/taste.draft.md
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { askRaw } from "../server/claude.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SYSTEM = `你是一个细心的、不油腻的"听众侧写师"。
我会给你一份用户在网易云的精简数据快照。
你的任务：写一份 \`taste.md\` 草稿，让另一个 AI（电台 DJ）能用它来"懂"这位听众。

**严格要求**：
- 第二人称（"你"），像在跟用户本人聊"我看到你是这样听歌的"
- 自然语言段落，不要 JSON 不要清单（少量举歌手名 OK）
- 必须覆盖：偏好风格 / 年代 / 语种、本命歌手（最多 5-8 个）、不同时段或心境的音乐对应、明显禁区（如果能推断）
- **诚实**：看不出来的别瞎编。数据没体现的就别写
- 每个判断附"我是怎么看出来的"——引用具体歌单名 / 歌手 / 频次
- 长度 800-1500 字
- 结尾留 \`## 待你补充\` 一段，列 3-5 个需要用户亲口说的问题
- 只输出 markdown，不要 \`\`\`md\`\`\` 包裹，不要前后说明`;

function buildCompactDump(data) {
  const lines = [];
  lines.push(`# 网易云数据精简快照\n`);
  lines.push(`## 最近 7 天 top（${data.week.length} 首，已按 playCount 倒排）`);
  for (const t of data.week) {
    lines.push(`- ${t.title} — ${t.artist}  ×${t.playCount}`);
  }
  lines.push(`\n## 全部时间 top 40`);
  for (const t of (data.allTime || []).slice(0, 40)) {
    lines.push(`- ${t.title} — ${t.artist}`);
  }
  lines.push(`\n## 自建歌单（${data.created.length}）—— 每单仅列 top 5`);
  for (const p of data.created) {
    lines.push(`\n### ${p.name}（${p.trackCount} 首）${p.tags?.length ? " · tag: " + p.tags.join("/") : ""}`);
    if (p.description) lines.push(`> ${p.description.replace(/\n/g, " ").slice(0, 200)}`);
    for (const t of (p.topTracks || []).slice(0, 5)) {
      lines.push(`- ${t.title} — ${t.artist}`);
    }
  }
  lines.push(`\n## 收藏歌单（${data.subscribed.length}）—— 只列名字`);
  for (const p of (data.subscribed || []).slice(0, 40)) {
    lines.push(`- ${p.name}${p.tags?.length ? " · " + p.tags.join("/") : ""}`);
  }
  return lines.join("\n");
}

async function main() {
  const jsonPath = path.join(ROOT, "user/playlists.json");
  const data = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  const dump = buildCompactDump(data);

  const dumpPath = path.join(ROOT, "user/playlists.compact.md");
  await fs.writeFile(dumpPath, dump, "utf8");
  console.log(`→ 精简快照已写：${dumpPath}（${dump.length} 字符）`);

  console.log("→ 调 claude 生成 taste.draft.md（Opus 慢，等 1-3 分钟）…");
  const t0 = Date.now();
  const md = await askRaw({ system: SYSTEM, user: dump, timeoutMs: 300_000 });
  console.log(`✓ 完成，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (!md.trim()) throw new Error("空输出");
  const outPath = path.join(ROOT, "user/taste.draft.md");
  await fs.writeFile(outPath, md, "utf8");
  console.log("✓ 写入：" + outPath);
  console.log("\n你审一遍，改两笔，确认满意后：mv user/taste.draft.md user/taste.md");
}

main().catch((e) => { console.error(e); process.exit(1); });
