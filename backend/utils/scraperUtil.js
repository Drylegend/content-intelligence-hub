import fetch from "node-fetch";
import * as cheerio from "cheerio";

export async function scrapeURL(url) {
  const normalizedUrl = new URL(url).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CIH-Bot/1.0; +https://example.com/bot)"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL. HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $("script, style, nav, footer, header, aside, noscript, iframe, svg").remove();

    const title = $("title").first().text().trim() || $("h1").first().text().trim() || normalizedUrl;
    const text = $("article, main, .content, .post-content, body")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (!text) {
      throw new Error("No readable text could be extracted from this page.");
    }

    return {
      title,
      text,
      wordCount: text.split(/\s+/).filter(Boolean).length
    };
  } finally {
    clearTimeout(timeout);
  }
}
