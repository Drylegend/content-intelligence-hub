import Content from "../models/contentModel.js";
import { uploadAudioDataUri } from "../utils/cloudinaryUtil.js";
import { streamAudioChunks } from "../utils/audioUtil.js";

export async function saveAudioMetadata(req, res, next) {
  try {
    const { audioUrl, audioMode, audioBase64, mimeType = "audio/mpeg" } = req.body;
    const content = await Content.findOne({ _id: req.params.contentId, userId: req.user._id });

    if (!content) {
      res.status(404);
      throw new Error("Content not found.");
    }

    let resolvedAudioUrl = audioUrl;

    if (!resolvedAudioUrl && audioBase64) {
      if (
        !process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
      ) {
        res.status(500);
        throw new Error("Cloudinary credentials are not configured.");
      }

      const dataUri = `data:${mimeType};base64,${audioBase64}`;
      const uploadResult = await uploadAudioDataUri(dataUri, `content-${content._id}-${Date.now()}`);
      resolvedAudioUrl = uploadResult.secure_url;
    }

    if (!resolvedAudioUrl) {
      res.status(400);
      throw new Error("audioUrl or audioBase64 is required.");
    }

    content.audioUrl = resolvedAudioUrl;
    content.audioMode = audioMode || content.audioMode || "summary";
    await content.save();

    res.json({
      message: "Audio metadata saved successfully.",
      contentId: content._id,
      audioUrl: content.audioUrl,
      audioMode: content.audioMode
    });
  } catch (error) {
    next(error);
  }
}

export async function streamAudio(ws, payload) {
  const { contentId, mode = "summary", voice = "en-US-AriaNeural", sessionId } = payload;

  if (!contentId || !sessionId) {
    throw new Error("contentId and sessionId are required for audio generation.");
  }

  const content = await Content.findById(contentId);
  if (!content) {
    throw new Error("Content not found.");
  }

  let textToSpeak = "";

  if (mode === "full") {
    textToSpeak = content.rawText;
  } else {
    textToSpeak = content.summary;
    if (!textToSpeak || !textToSpeak.trim()) {
      throw new Error("Generate a summary first or switch audio mode to full text.");
    }
  }

  if (!textToSpeak || !textToSpeak.trim()) {
    throw new Error("There is no text available to convert into audio.");
  }

  content.audioMode = mode;
  content.jobState = {
    sessionId,
    status: "processing",
    progress: 0,
    startedAt: new Date()
  };
  await content.save();

  await streamAudioChunks(ws, textToSpeak, voice, sessionId, async (progressState) => {
    content.jobState = {
      ...content.jobState,
      status: "processing",
      progress: progressState.progress,
      lastChunkIndex: progressState.index,
      totalChunks: progressState.total
    };
    await content.save();
  });

  content.jobState = {
    ...content.jobState,
    status: "completed",
    progress: 100,
    finishedAt: new Date()
  };
  await content.save();
}
