import mongoose from "mongoose";

const uploadSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    totalSize: { type: Number, required: true },
    totalChunks: { type: Number, required: true },
    status: {
      type: String,
      enum: ["UPLOADING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "UPLOADING",
    },
    finalHash: { type: String },
  },
  { timestamps: true }
);

export const Upload = mongoose.model("Upload", uploadSchema);
