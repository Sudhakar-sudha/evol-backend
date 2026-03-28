import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import routes from "./routes/IndexRoutes.js";
import chatSocket from "./sockets/chatSocket.js";

dotenv.config();

const app = express();

// body parser
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// cors (IMPORTANT for refresh token cookies)
app.use(cors({
  origin: "*",
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


// Socket setup
chatSocket(io);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  server.listen(PORT, () =>
    console.log(`Server running at http://0.0.0.0:${PORT}`)
  );
};

startServer();
