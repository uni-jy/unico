import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const CODE_ROOT = path.resolve(__dirname, "..");
export const RUNTIME_ROOT = process.env.UNICO_RUNTIME_ROOT
  || (process.env.VERCEL ? path.join(os.tmpdir(), "unico") : CODE_ROOT);

export const DATA_DIR = process.env.UNICO_DATA_DIR || path.join(RUNTIME_ROOT, "data");
export const USERS_DIR = path.join(DATA_DIR, "users");
export const CACHE_DIR = process.env.UNICO_CACHE_DIR || path.join(RUNTIME_ROOT, "cache");
export const TTS_DIR = path.join(CACHE_DIR, "tts");
export const TMP_DIR = path.join(CACHE_DIR, "tmp");
