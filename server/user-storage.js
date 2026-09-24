import fs from "node:fs";
import path from "node:path";
import { get as blobGet, list as blobList, put as blobPut } from "@vercel/blob";
import { USERS_DIR } from "./paths.js";

const USER_PREFIX = "users";

function isSafeRelativePath(value) {
  if (!value || value.startsWith("/") || value.includes("\\")) return false;
  return !value.split("/").some((part) => part === ".." || part === "");
}

function userDir(uid) {
  return path.join(USERS_DIR, uid);
}

function userBlobPrefix(uid) {
  return `${USER_PREFIX}/${uid}/`;
}

function hasBlobEnv() {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID));
}

async function readBlobText(blob, { get, fetcher }) {
  if (get) {
    const result = await get(blob.pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return new Response(result.stream).text();
  }
  const response = await fetcher(blob.downloadUrl || blob.url);
  if (!response.ok) throw new Error(`blob fetch failed: ${response.status || "unknown"}`);
  return response.text();
}

function walkFiles(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) return walkFiles(abs);
      if (!entry.isFile()) return [];
      return [abs];
    });
  } catch {
    return [];
  }
}

export function createUserStorage({
  enabled = hasBlobEnv(),
  list = blobList,
  put = blobPut,
  get = blobGet,
  fetcher = fetch,
} = {}) {
  async function hydrateUserFiles(uid) {
    if (!enabled) return { enabled: false, files: 0 };
    const prefix = userBlobPrefix(uid);
    let cursor;
    let files = 0;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      for (const blob of page.blobs || []) {
        const rel = blob.pathname.slice(prefix.length);
        if (!isSafeRelativePath(rel)) continue;
        const text = await readBlobText(blob, { get, fetcher });
        if (text == null) continue;
        const abs = path.join(userDir(uid), rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, text, "utf8");
        files += 1;
      }
      cursor = page.cursor;
    } while (cursor);
    return { enabled: true, files };
  }

  async function persistUserFiles(uid) {
    if (!enabled) return { enabled: false, files: 0 };
    const dir = userDir(uid);
    const files = walkFiles(dir);
    for (const abs of files) {
      const rel = path.relative(dir, abs).split(path.sep).join("/");
      if (!isSafeRelativePath(rel)) continue;
      await put(`${userBlobPrefix(uid)}${rel}`, fs.readFileSync(abs), {
        access: "private",
        allowOverwrite: true,
        cacheControlMaxAge: 60,
      });
    }
    return { enabled: true, files: files.length };
  }

  return { hydrateUserFiles, persistUserFiles };
}

const defaultStorage = createUserStorage();

export const hydrateUserFiles = defaultStorage.hydrateUserFiles;
export const persistUserFiles = defaultStorage.persistUserFiles;
