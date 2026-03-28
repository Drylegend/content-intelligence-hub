import Content from "../models/contentModel.js";
import { scrapeURL } from "../utils/scraperUtil.js";

export async function scrapeFromUrl(req, res, next) {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400);
      throw new Error("A URL is required.");
    }

    const { title, text, wordCount } = await scrapeURL(url);
    const content = await Content.create({
      userId: req.user._id,
      sourceType: "url",
      sourceUrl: url,
      title,
      rawText: text,
      wordCount
    });

    res.status(201).json({
      contentId: content._id,
      title,
      preview: text.slice(0, 500),
      wordCount
    });
  } catch (error) {
    next(error);
  }
}
