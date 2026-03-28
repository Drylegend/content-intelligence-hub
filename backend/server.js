import path from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import scraperRoutes from "./routes/scraperRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import contentRoutes from "./routes/contentRoutes.js";
import audioRoutes from "./routes/audioRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { streamAudio } from "./controllers/audioController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

dns.setDefaultResultOrder("ipv4first");

dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(rootDir, ".env"), override: false });

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const frontendDir = path.join(rootDir, "frontend");
const reactAppDir = path.join(rootDir, "react-app");

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(frontendDir));
app.use("/react-app", express.static(reactAppDir));

app.get("/", (req, res) => {
  res.redirect("/html/index.html");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", userRoutes);
app.use("/api/scrape", scraperRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/audio", audioRoutes);
app.use("/api/contact", contactRoutes);

wss.on("connection", (ws) => {
  ws.on("message", async (rawMessage) => {
    try {
      const payload = JSON.parse(rawMessage.toString());

      if (payload.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if (payload.type === "generate") {
        await streamAudio(ws, payload);
        return;
      }

      ws.send(JSON.stringify({ type: "error", message: "Unknown WebSocket message type." }));
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: "error",
          sessionId: (() => {
            try {
              return JSON.parse(rawMessage.toString()).sessionId;
            } catch {
              return undefined;
            }
          })(),
          message: error.message || "Audio generation failed."
        })
      );
    }
  });
});

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT || 3000);

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing. Add it to backend/.env or .env.");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing. Add it to backend/.env or .env.");
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      family: 4,
      serverSelectionTimeoutMS: 15000
    });
    server.listen(port, () => {
      console.log(`Content Intelligence Hub server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
