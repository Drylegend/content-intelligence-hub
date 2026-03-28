import express from "express";
import { scrapeFromUrl } from "../controllers/scraperController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, scrapeFromUrl);

export default router;
