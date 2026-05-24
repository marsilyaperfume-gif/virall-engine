import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

dotenv.config();
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 1024 * 1024 * 1024 }
});

app.get("/health", (req, res) => res.json({ ok: true, service: "marrsile-v11-video-repair" }));

app.get("/auth/instagram", (req, res) => res.status(501).json({ message: "Meta OAuth implementation goes here" }));

app.post("/api/video/repair", upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No video uploaded" });

  const input = req.file.path;
  const output = path.join(os.tmpdir(), `${randomUUID()}-fixed.mp4`);

  // No downscaling. Keeps same resolution. Uses high-quality CRF 16 and AAC audio for browser/Instagram compatibility.
  ffmpeg(input)
    .outputOptions([
      "-map 0:v:0",
      "-map 0:a?",
      "-c:v libx264",
      "-preset slow",
      "-crf 16",
      "-pix_fmt yuv420p",
      "-profile:v high",
      "-level 4.2",
      "-c:a aac",
      "-b:a 320k",
      "-movflags +faststart",
      "-map_metadata 0"
    ])
    .format("mp4")
    .on("end", () => {
      res.download(output, "fixed-video.mp4", () => {
        fs.rm(input, { force: true }, () => {});
        fs.rm(output, { force: true }, () => {});
      });
    })
    .on("error", (err) => {
      console.error(err);
      fs.rm(input, { force: true }, () => {});
      fs.rm(output, { force: true }, () => {});
      res.status(500).json({ error: "Video repair failed" });
    })
    .save(output);
});

app.post("/api/publish/reel", (req, res) => res.json({ ok: true, message: "Instagram publish placeholder" }));

app.listen(process.env.PORT || 3000, () => console.log("v11 video repair server running"));
