import express from "express";
import { saveAudioMetadata } from "../controllers/audioController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/:contentId/save", protect, saveAudioMetadata);

export default router;
