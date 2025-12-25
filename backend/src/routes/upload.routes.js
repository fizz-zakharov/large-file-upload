import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Upload } from "../models/upload.model.js";
import { Chunk } from "../models/chunk.model.js";

const router = express.Router();

// Needed for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * POST /uploads/init
 * Handshake API to initialize or resume an upload
 */
router.post("/init", async (req, res) => {
  try {
    const { filename, totalSize, chunkSize } = req.body;

    if (!filename || !totalSize || !chunkSize) {
      return res.status(400).json({
        message: "filename, totalSize and chunkSize are required",
      });
    }

    const totalChunks = Math.ceil(totalSize / chunkSize);

    let upload = await Upload.findOne({ filename, totalSize });

    if (!upload) {
      upload = await Upload.create({
        filename,
        totalSize,
        totalChunks,
        status: "UPLOADING",
      });
    }

    const uploadedChunks = await Chunk.find(
      { uploadId: upload._id },
      { chunkIndex: 1, _id: 0 }
    );

    return res.json({
      uploadId: upload._id,
      uploadedChunks: uploadedChunks.map((c) => c.chunkIndex),
      totalChunks,
    });
  } catch (error) {
    console.error("Upload init error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /uploads/:uploadId/chunk
 * Streams a chunk to disk at the correct offset
 */
router.post("/:uploadId/chunk", async (req, res) => {
  try {
    const { uploadId } = req.params;
    const chunkIndex = Number(req.query.chunkIndex);

    if (Number.isNaN(chunkIndex)) {
      return res.status(400).json({ message: "Invalid chunkIndex" });
    }

    // 1. Check upload exists
    const upload = await Upload.findById(uploadId);
    if (!upload) {
      return res.status(404).json({ message: "Upload not found" });
    }

    // 2. Idempotency check
    const existingChunk = await Chunk.findOne({ uploadId, chunkIndex });
    if (existingChunk) {
      return res.json({ message: "Chunk already uploaded" });
    }

    // 3. Prepare file path
    const uploadsDir = path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsDir, `${uploadId}.bin`);

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }

    // ✅ CRITICAL FIX: Ensure file exists before r+ write
    if (!fs.existsSync(filePath)) {
      fs.closeSync(fs.openSync(filePath, "w"));
    }

    // 4. Calculate offset
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
    const offset = chunkIndex * CHUNK_SIZE;

    // 5. Stream write to correct offset
    const writeStream = fs.createWriteStream(filePath, {
      flags: "r+",
      start: offset,
    });

    req.pipe(writeStream);

    writeStream.on("finish", async () => {
      await Chunk.create({
        uploadId,
        chunkIndex,
        status: "RECEIVED",
      });

      return res.json({ message: "Chunk uploaded successfully" });
    });

    writeStream.on("error", (err) => {
      console.error("Write stream error:", err);
      return res.status(500).json({ message: "File write failed" });
    });
  } catch (error) {
    console.error("Chunk upload error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
