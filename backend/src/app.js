import express from "express";
import uploadRoutes from "./routes/upload.routes.js";

const app = express();

app.use(express.json());

// Register upload routes
app.use("/uploads", uploadRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
