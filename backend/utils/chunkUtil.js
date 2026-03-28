export const CHUNK_SIZE = 150;
export const CONCURRENCY = 5;
export const MAX_RETRIES = 5;
export const BACKOFF_BASE = 2000;

export function isSpeakable(text) {
  return /[a-zA-Z]/.test(text) && text.trim().length > 3;
}

export function chunkText(text, chunkSize = CHUNK_SIZE) {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean);

  const chunks = [];
  for (let index = 0; index < words.length; index += chunkSize) {
    const chunk = words.slice(index, index + chunkSize).join(" ");
    if (isSpeakable(chunk)) {
      chunks.push(chunk);
    }
  }

  return chunks;
}
