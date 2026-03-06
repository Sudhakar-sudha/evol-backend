import express from "express";
import authRoutes from "./authRoutes.js";
import inviteRoutes from "./InviteRouts.js";
import profileRoutes from "./profileRoutes.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/profile", protect, profileRoutes);
router.use("/invitepartner", inviteRoutes);

export default router;
