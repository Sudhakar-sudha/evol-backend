import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import routes from "./routes/IndexRoutes.js";

dotenv.config();

const app = express();

// body parser
app.use(express.json());

// cors (IMPORTANT for refresh token cookies)
app.use(cors({
  origin: "http://localhost:8081",
  credentials: true,
}));

// security
app.use(helmet());

// rate limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
}));
app.use(cookieParser());
// routes
app.use("/api", routes);

// health
app.get("/", (req, res) => {
  res.send("API running 🚀");
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () =>
    console.log(`Server running at http://0.0.0.0:${PORT}`)
  );
};

startServer();
