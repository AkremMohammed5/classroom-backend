import express from "express";
import subjectsRouter from "./router/subject";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));
app.use("/api/subjects", subjectsRouter);

app.get("/", (req, res) => {
  res.send("Welcome to the Classroom API");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;