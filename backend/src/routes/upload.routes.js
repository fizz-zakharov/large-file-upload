import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import unzipper from "unzipper";
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

/**
 * POST /uploads/:uploadId/finalize
 * Finalizes upload: verifies chunks, hashes file, peeks ZIP, marks completed
 */
router.post("/:uploadId/finalize", async (req, res) => {
  try {
    const { uploadId } = req.params;

    // 1. Fetch upload
    const upload = await Upload.findById(uploadId);
    if (!upload) {
      return res.status(404).json({ message: "Upload not found" });
    }

    // 2. Prevent double finalization
    if (upload.status === "COMPLETED") {
      return res.json({
        message: "Upload already finalized",
        finalHash: upload.finalHash,
      });
    }

    // 3. Check if all chunks are uploaded
    const chunkCount = await Chunk.countDocuments({ uploadId });
    if (chunkCount !== upload.totalChunks) {
      return res.status(400).json({
        message: "Upload incomplete",
        uploadedChunks: chunkCount,
        totalChunks: upload.totalChunks,
      });
    }

    const filePath = path.join(process.cwd(), "uploads", `${uploadId}.bin`);

    // 4. Calculate SHA-256 hash (STREAMING)
    const hash = crypto.createHash("sha256");
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .on("data", (data) => hash.update(data))
        .on("end", resolve)
        .on("error", reject);
    });

    const finalHash = hash.digest("hex");

    // 5. Peek ZIP contents (STREAMING, NO EXTRACTION)
    const zipEntries = [];

    await fs
      .createReadStream(filePath)
      .pipe(unzipper.Parse())
      .on("entry", (entry) => {
        zipEntries.push(entry.path);
        entry.autodrain(); // important: do not extract
      })
      .promise();

    // 6. Mark upload completed
    upload.status = "COMPLETED";
    upload.finalHash = finalHash;
    await upload.save();

    // 7. Respond
    return res.json({
      message: "Upload finalized successfully",
      finalHash,
      filesInZip: zipEntries,
    });
  } catch (error) {
    console.error("Finalize error:", error);
    return res.status(500).json({ message: "Finalization failed" });
  }
});


export default router;
