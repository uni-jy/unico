export const QUEUE_TARGET = 5;
export const BOOT_MIN_QUEUE = 2;

export function normalizeTrackKey(title = "", artist = "") {
  const clean = (s) => String(s || "")
    .toLowerCase()
    .replace(/[—–－]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return `${clean(title)}|${clean(artist)}`;
}

function addTrack(set, track) {
  if (!track?.title || !track?.artist) return;
  set.add(normalizeTrackKey(track.title, track.artist));
}

const LOW_QUALITY_RX = [
  /儿歌|儿童|宝宝巴士|睡前故事|胎教|幼儿|亲子/,
  /(^|[\s([{（【])dj(?=[\s\]})）】\u4e00-\u9fa5_-]|$)|dj小|mc喊麦|喊麦|土嗨/i,
  /抖音|快手|热播|神曲|网红|串烧|车载|酒吧慢摇/,
  /原神|王者荣耀|和平精英|游戏(?:音乐|bgm)?|二创|鬼畜|meme|梗曲/,
  /\bbgm\b|背景音乐|伴奏|钢琴伴奏|纯伴奏|翻奏|铃声|提示音/i,
  /remix|bootleg|hardstyle|slowed|sped up|nightcore|雷米克斯/i,
  /cover|翻唱|重制版|改编版|饭制/i,
  /x歌手|歌手\d*|我是歌手|中国好声音|节目版|综艺/i,
  /洛天依|初音|虚拟歌手|vocaloid/i,
  /扣税国王|玩原神要扣税|小小智/,
];

export function isLowQualityRecommendation(track = {}) {
  const text = [
    track.title,
    track.artist,
    track.album,
    track.reason,
    track.pickReason,
  ].filter(Boolean).join(" ");
  return LOW_QUALITY_RX.some((rx) => rx.test(text));
}

export function buildKnownTrackSet({
  playlists = {},
  recentPlays = [],
  playedTracks = [],
  queuedTracks = [],
  dislikedTracks = new Set(),
} = {}) {
  const known = new Set();
  for (const track of playlists.week || []) addTrack(known, track);
  for (const track of playlists.allTime || []) addTrack(known, track);
  for (const playlist of playlists.created || []) {
    for (const track of playlist.topTracks || []) addTrack(known, track);
  }
  for (const track of recentPlays) addTrack(known, track);
  for (const track of playedTracks) addTrack(known, track);
  for (const track of queuedTracks) addTrack(known, track);
  for (const key of dislikedTracks) {
    const [title, artist] = String(key).split("|");
    if (title && artist) known.add(normalizeTrackKey(title, artist));
  }
  return known;
}

export function filterUnheardCandidates(candidates = [], known = new Set()) {
  const seen = new Set(known);
  const out = [];
  for (const track of candidates) {
    if (!track?.title || !track?.artist) continue;
    if (isLowQualityRecommendation(track)) continue;
    const key = normalizeTrackKey(track.title, track.artist);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(track);
  }
  return out;
}
