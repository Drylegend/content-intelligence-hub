import dns from "node:dns";
import { EdgeTTS } from "edge-tts-universal";
import { BACKOFF_BASE, CONCURRENCY, MAX_RETRIES, chunkText } from "./chunkUtil.js";

dns.setDefaultResultOrder("ipv4first");

function normalizeAudioBuffer(audio) {
  if (Buffer.isBuffer(audio)) {
    return audio;
  }

  if (audio instanceof Blob) {
    return audio.arrayBuffer().then((arrayBuffer) => Buffer.from(arrayBuffer));
  }

  if (audio instanceof ArrayBuffer) {
    return Buffer.from(audio);
  }

  if (ArrayBuffer.isView(audio)) {
    return Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
  }

  if (typeof audio === "string") {
    return Buffer.from(audio, "base64");
  }

  throw new Error("Unsupported audio buffer returned by edge-tts-universal.");
}

async function generateChunkWithRetry(text, voice, attempt = 0) {
  try {
    const tts = new EdgeTTS(text, voice);
    const result = await tts.synthesize();
    return await normalizeAudioBuffer(result.audio);
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      throw error;
    }

    const delay = BACKOFF_BASE * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return generateChunkWithRetry(text, voice, attempt + 1);
  }
}

export async function streamAudioChunks(ws, text, voice, sessionId, onProgress) {
  const chunks = chunkText(text);
  const total = chunks.length;
  let completed = 0;

  ws.send(
    JSON.stringify({
      type: "start",
      sessionId,
      total
    })
  );

  for (let index = 0; index < chunks.length; index += CONCURRENCY) {
    const batch = chunks.slice(index, index + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((chunk) => generateChunkWithRetry(chunk, voice))
    );

    for (let batchIndex = 0; batchIndex < results.length; batchIndex += 1) {
      const currentIndex = index + batchIndex;
      const result = results[batchIndex];

      if (result.status === "fulfilled") {
        completed += 1;

        ws.send(
          JSON.stringify({
            type: "chunk",
            sessionId,
            index: currentIndex,
            total,
            progress: Math.round((completed / total) * 100),
            audio: result.value.toString("base64")
          })
        );

        if (onProgress) {
          await onProgress({
            index: currentIndex,
            total,
            progress: Math.round((completed / total) * 100)
          });
        }
      } else {
        ws.send(
          JSON.stringify({
            type: "chunk-error",
            sessionId,
            index: currentIndex,
            total,
            message: result.reason?.message || "Chunk generation failed."
          })
        );
      }
    }
  }

  ws.send(
    JSON.stringify({
      type: "done",
      sessionId,
      total,
      completed
    })
  );
}
