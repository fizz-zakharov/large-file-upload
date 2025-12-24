import mongoose from "mongoose";

const chunkSchema = new mongoose.Schema(
  {
    uploadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Upload",
      required: true,
    },
    chunkIndex: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PENDING", "RECEIVED"],
      default: "RECEIVED",
    },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

chunkSchema.index({ uploadId: 1, chunkIndex: 1 }, { unique: true });

export const Chunk = mongoose.model("Chunk", chunkSchema);
