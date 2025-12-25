import express from "express";
import { Upload } from "../models/upload.model.js";
import { Chunk } from "../models/chunk.model.js";

const router = express.Router();

/**
 * POST /uploads/init
 * Handshake API to initialize or resume an upload
 */
router.post("/init", async (req, res) => {
  try {
    const { filename, totalSize, chunkSize } = req.body;

    // 1. Basic validation
    if (!filename || !totalSize || !chunkSize) {
      return res.status(400).json({
        message: "filename, totalSize and chunkSize are required",
      });
    }

    // 2. Calculate total chunks
    const totalChunks = Math.ceil(totalSize / chunkSize);

    // 3. Find existing upload (resume case)
    let upload = await Upload.findOne({ filename, totalSize });

    // 4. If not found, create new upload
    if (!upload) {
      upload = await Upload.create({
        filename,
        totalSize,
        totalChunks,
        status: "UPLOADING",
      });
    }

    // 5. Fetch already uploaded chunks
    const uploadedChunks = await Chunk.find(
      { uploadId: upload._id },
      { chunkIndex: 1, _id: 0 }
    );

    // 6. Respond with upload state
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

export default router;
