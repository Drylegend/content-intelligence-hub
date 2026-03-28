import express from "express";
import {
  deleteContent,
  getContentById,
  getContentStats,
  listContent,
  saveContent,
  summarizeContent
} from "../controllers/contentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", listContent);
router.get("/stats", getContentStats);
router.get("/summarize/:contentId", summarizeContent);
router.post("/save", saveContent);
router.get("/:contentId", getContentById);
router.delete("/:contentId", deleteContent);

export default router;
