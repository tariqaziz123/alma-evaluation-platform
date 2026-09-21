import express from "express";
import cors from "cors";
import helmet from "helmet";

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

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
