import mongoose from "mongoose";

const contentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sourceType: { type: String, enum: ["url", "file"], required: true },
  sourceUrl: { type: String, default: "" },
  fileName: { type: String, default: "" },
  title: { type: String, default: "" },
  rawText: { type: String, required: true },
  summary: { type: String, default: "" },
  wordCount: { type: Number, default: 0 },
  audioUrl: { type: String, default: "" },
  audioMode: { type: String, enum: ["full", "summary", ""], default: "" },
  jobState: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Content", contentSchema);
