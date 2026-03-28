import Content from "../models/contentModel.js";
import { summarizeText } from "../utils/summarizerUtil.js";

function buildPreview(text) {
  return String(text || "").slice(0, 500);
}

export async function saveContent(req, res, next) {
  try {
    const {
      sourceType = "file",
      sourceUrl = "",
      fileName = "",
      title = "",
      rawText
    } = req.body;

    if (!rawText || !String(rawText).trim()) {
      res.status(400);
      throw new Error("rawText is required.");
    }

    const normalizedText = String(rawText).trim();
    const wordCount = normalizedText.split(/\s+/).filter(Boolean).length;

    const content = await Content.create({
      userId: req.user._id,
      sourceType,
      sourceUrl,
      fileName,
      title: title || fileName || sourceUrl || "Untitled Content",
      rawText: normalizedText,
      wordCount
    });

    res.status(201).json({
      contentId: content._id,
      title: content.title,
      preview: buildPreview(content.rawText),
      wordCount: content.wordCount,
      createdAt: content.createdAt
    });
  } catch (error) {
    next(error);
  }
}

export async function listContent(req, res, next) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 50);
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();

    const query = { userId: req.user._id };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { sourceUrl: { $regex: search, $options: "i" } },
        { fileName: { $regex: search, $options: "i" } }
      ];
    }

    const [items, total] = await Promise.all([
      Content.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Content.countDocuments(query)
    ]);

    res.json({
      items,
      page,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
}

export async function getContentById(req, res, next) {
  try {
    const content = await Content.findOne({ _id: req.params.contentId, userId: req.user._id }).lean();
    if (!content) {
      res.status(404);
      throw new Error("Content not found.");
    }

    res.json(content);
  } catch (error) {
    next(error);
  }
}

export async function getContentStats(req, res, next) {
  try {
    const [totalScrapes, totalSummaries, totalAudioItems, items] = await Promise.all([
      Content.countDocuments({ userId: req.user._id }),
      Content.countDocuments({ userId: req.user._id, summary: { $ne: "" } }),
      Content.countDocuments({ userId: req.user._id, audioUrl: { $ne: "" } }),
      Content.find({ userId: req.user._id }).select("audioUrl").lean()
    ]);

    const storageUsedBytes = items.reduce((total, item) => {
      return total + Buffer.byteLength(item.audioUrl || "", "utf8");
    }, 0);

    res.json({
      totalScrapes,
      totalSummaries,
      totalAudioItems,
      storageUsedBytes
    });
  } catch (error) {
    next(error);
  }
}

export async function summarizeContent(req, res, next) {
  try {
    const content = await Content.findOne({ _id: req.params.contentId, userId: req.user._id });
    if (!content) {
      res.status(404);
      throw new Error("Content not found.");
    }

    const summary = await summarizeText(content.rawText);
    content.summary = summary;
    await content.save();

    res.json({
      contentId: content._id,
      summary,
      originalWordCount: content.wordCount,
      summaryWordCount: summary.split(/\s+/).filter(Boolean).length
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteContent(req, res, next) {
  try {
    const content = await Content.findOneAndDelete({ _id: req.params.contentId, userId: req.user._id });
    if (!content) {
      res.status(404);
      throw new Error("Content not found.");
    }

    res.json({ message: "Content deleted successfully." });
  } catch (error) {
    next(error);
  }
}
