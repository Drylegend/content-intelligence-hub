import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI;

function getGenAI() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  return genAI;
}

function getModelCandidates() {
  const configured = String(process.env.GEMINI_MODEL || "").trim();
  const defaults = ["gemini-2.5-flash", "gemini-2.0-flash"];

  return [configured, ...defaults].filter((value, index, array) => {
    return value && array.indexOf(value) === index;
  });
}

function isModelNotFoundError(error) {
  const message = String(error?.message || "");
  return message.includes("404") || message.includes("not found for API version");
}

export async function summarizeText(text) {
  const prompt = `Summarize the following text concisely.
Keep key facts, main ideas, and important details.
Aim for roughly 3-5% of the original length.
Return plain text only, no markdown.

TEXT:
${text}`;

  let lastError;

  for (const modelName of getModelCandidates()) {
    try {
      const model = getGenAI().getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      lastError = error;
      if (!isModelNotFoundError(error)) {
        throw error;
      }
    }
  }

  throw new Error(
    `No configured Gemini summarization model is available. Tried: ${getModelCandidates().join(", ")}. ${String(
      lastError?.message || ""
    )}`.trim()
  );
}
