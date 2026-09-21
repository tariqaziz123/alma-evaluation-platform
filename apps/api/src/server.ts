import express from "express";
import cors from "cors";
import helmet from "helmet";
import submissionsRouter from "./routes/submissions.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "alma-evaluation-api",
  });
});

app.use("/api/v1/submissions", submissionsRouter);

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});