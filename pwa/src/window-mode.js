const KEY = "unico.windowMode";

function storageGet(storage, key) {
  if (!storage) return null;
  if (typeof storage.getItem === "function") return storage.getItem(key);
  if (typeof storage.get === "function") return storage.get(key);
  return storage[key] ?? null;
}

function storageSet(storage, key, value) {
  if (!storage) return;
  if (typeof storage.setItem === "function") storage.setItem(key, value);
  else if (typeof storage.set === "function") storage.set(key, value);
  else storage[key] = value;
}

export function getInitialWindowMode(search = "", storage = globalThis.localStorage) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (params.get("window") === "1") return true;
  if (params.get("window") === "0") return false;
  return storageGet(storage, KEY) === "1";
}

export function setWindowModePreference(enabled, storage = globalThis.localStorage) {
  storageSet(storage, KEY, enabled ? "1" : "0");
}

export function buildWindowUrl(href = globalThis.location?.href || "") {
  const url = new URL(href);
  url.searchParams.set("window", "1");
  return url.toString();
}

export function buildPopoutFeatures({
  width = 420,
  height = 640,
  left,
  top,
} = {}) {
  const x = Number.isFinite(Number(left)) ? Number(left) : Math.max(0, Math.round((globalThis.screen?.availWidth ?? 1280) - width - 48));
  const y = Number.isFinite(Number(top)) ? Number(top) : 64;
  return [
    "popup=yes",
    `width=${Math.max(320, Math.round(width))}`,
    `height=${Math.max(420, Math.round(height))}`,
    `left=${Math.max(0, Math.round(x))}`,
    `top=${Math.max(0, Math.round(y))}`,
    "resizable=yes",
    "scrollbars=no",
  ].join(",");
}
