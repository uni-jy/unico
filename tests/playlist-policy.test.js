import test from "node:test";
import assert from "node:assert/strict";
import {
  QUEUE_TARGET,
  BOOT_MIN_QUEUE,
  buildKnownTrackSet,
  normalizeTrackKey,
  filterUnheardCandidates,
  isLowQualityRecommendation,
} from "../server/playlist-policy.js";

const playlists = {
  week: [{ title: "山海", artist: "草东没有派对", playCount: 8 }],
  allTime: [{ title: "理想三旬", artist: "陈鸿宇", playCount: 99 }],
  created: [
    {
      name: "旧歌单",
      topTracks: [
        { title: "十万嬉皮", artist: "万能青年旅店" },
      ],
    },
  ],
};

test("queue target is five pending unheard tracks", () => {
  assert.equal(QUEUE_TARGET, 5);
  assert.equal(BOOT_MIN_QUEUE, 2);
});

test("known track set includes imported history and normalizes separators", () => {
  const known = buildKnownTrackSet({
    playlists,
    recentPlays: [{ title: "Miss Wanderer", artist: "西楼" }],
    playedTracks: [{ title: "深蓝", artist: "陈婧霏" }],
    queuedTracks: [{ title: "未来俱乐部", artist: "声音玩具" }],
    dislikedTracks: new Set(["讨厌的歌|某歌手"]),
  });

  assert.equal(known.has(normalizeTrackKey("山海", "草东没有派对")), true);
  assert.equal(known.has(normalizeTrackKey("理想三旬", "陈鸿宇")), true);
  assert.equal(known.has(normalizeTrackKey("十万嬉皮", "万能青年旅店")), true);
  assert.equal(known.has(normalizeTrackKey("Miss Wanderer", "西楼")), true);
  assert.equal(known.has(normalizeTrackKey("深蓝", "陈婧霏")), true);
  assert.equal(known.has(normalizeTrackKey("未来俱乐部", "声音玩具")), true);
  assert.equal(known.has(normalizeTrackKey("讨厌的歌", "某歌手")), true);
});

test("filterUnheardCandidates keeps only resolvable tracks outside known history", () => {
  const known = buildKnownTrackSet({
    playlists,
    recentPlays: [{ title: "Miss Wanderer", artist: "西楼" }],
  });
  const candidates = [
    { title: "山海", artist: "草东没有派对" },
    { title: "Miss Wanderer", artist: "西楼" },
    { title: "New Skin", artist: "Unknown Band" },
    { title: "", artist: "No Title" },
    null,
    { title: "new skin", artist: "unknown band" },
  ];

  assert.deepEqual(filterUnheardCandidates(candidates, known), [
    { title: "New Skin", artist: "Unknown Band" },
  ]);
});

test("low quality recommendation filter rejects kid, DJ, game meme, and BGM tracks", () => {
  const bad = [
    { title: "落泪", artist: "DJ小小智" },
    { title: "扣税国王（玩原神要扣税）", artist: "雷米克斯" },
    { title: "亲亲我的宝贝 (新编儿童版)", artist: "儿歌宝贝" },
    { title: "宝宝巴士睡前故事", artist: "宝宝巴士" },
    { title: "钢琴伴奏版", artist: "治愈 BGM" },
    { title: "抖音热播 remix", artist: "DJ阿远" },
    { title: "路口（cover张悬/陈升）", artist: "陈俊娥" },
    { title: "夏天", artist: "洛天依 / 栖亦久" },
    { title: "晚风 (x歌手)", artist: "何亮辰 / 陈婧霏" },
  ];
  for (const track of bad) {
    assert.equal(isLowQualityRecommendation(track), true, `${track.title} — ${track.artist}`);
  }

  assert.equal(isLowQualityRecommendation({ title: "跳东湖", artist: "虎啸春" }), false);
  assert.equal(isLowQualityRecommendation({ title: "中南海", artist: "Carsick Cars" }), false);
  assert.equal(isLowQualityRecommendation({ title: "南方 (Live)", artist: "达达乐队" }), false);
});
