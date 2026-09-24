export const SILENT_WAV =
  "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQIAAAAAAA==";

export async function unlockAudioElement(audio, silentSrc = SILENT_WAV) {
  if (!audio || typeof audio.play !== "function") return false;

  const previousSrc = audio.src || "";
  const previousMuted = !!audio.muted;
  const previousVolume = typeof audio.volume === "number" ? audio.volume : 1;
  let unlocked = false;

  try {
    audio.muted = true;
    audio.volume = 0;
    audio.src = silentSrc;
    if (typeof audio.load === "function") audio.load();
    await audio.play();
    unlocked = true;
  } catch {
    unlocked = false;
  } finally {
    try {
      if (typeof audio.pause === "function") audio.pause();
    } catch {}
    try {
      if (typeof audio.removeAttribute === "function") audio.removeAttribute("src");
      else audio.src = "";
      if (previousSrc) audio.src = previousSrc;
      audio.muted = previousMuted;
      audio.volume = previousVolume;
      if (typeof audio.load === "function" && previousSrc) audio.load();
    } catch {}
  }

  return unlocked;
}
