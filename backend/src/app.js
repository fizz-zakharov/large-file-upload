import express from "express";
import cors from "cors";
import uploadRoutes from "./routes/upload.routes.js";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  })
);
app.use(express.json());

// Routes
app.use("/uploads", uploadRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
