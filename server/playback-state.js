import fs from "node:fs";

function compactTrack(track = {}) {
  if (!track || typeof track !== "object") return null;
  const title = String(track.title || "").trim();
  const artist = String(track.artist || "").trim();
  const url = String(track.url || "").trim();
  if (!title && !url) return null;
  return {
    id: track.id ? String(track.id) : "",
    title,
    artist,
    url,
    picUrl: track.picUrl ? String(track.picUrl) : "",
    source: track.source ? String(track.source) : "",
    duration: Number.isFinite(Number(track.duration)) ? Math.max(0, Math.floor(Number(track.duration))) : 0,
    reason: track.reason ? String(track.reason) : "",
    exploration: !!track.exploration,
  };
}

function cleanUpdatedAt(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date().toISOString();
  const time = Date.parse(value);
  return Number.isNaN(time) ? new Date().toISOString() : value;
}

export function sanitizePlaybackState(input = {}) {
  const currentTrack = compactTrack(input.currentTrack);
  const queue = Array.isArray(input.queue)
    ? input.queue.map(compactTrack).filter(Boolean).slice(0, 20)
    : [];
  return {
    started: !!input.started,
    paused: input.paused !== false,
    progressSeconds: Number.isFinite(Number(input.progressSeconds))
      ? Math.max(0, Math.floor(Number(input.progressSeconds)))
      : 0,
    currentTrack,
    queue,
    updatedAt: cleanUpdatedAt(input.updatedAt),
  };
}

export function loadPlaybackState(tenant) {
  try {
    const raw = fs.readFileSync(tenant.playbackStatePath, "utf8");
    return sanitizePlaybackState(JSON.parse(raw));
  } catch {
    return sanitizePlaybackState();
  }
}

export function savePlaybackState(tenant, input) {
  const state = sanitizePlaybackState(input);
  fs.writeFileSync(tenant.playbackStatePath, JSON.stringify(state, null, 2));
  return state;
}
