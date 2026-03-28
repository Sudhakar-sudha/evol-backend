import express from "express";
import {
    invitePartner,
    getPendingInvite,
    acceptPartnerInvite,
    rejectPartnerInvite,
    disconnectPartner
} from "../controllers/InviteController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/invite", protect, invitePartner);
router.get("/pending-invite", protect, getPendingInvite);
router.post("/accept-invite", protect, acceptPartnerInvite);
router.post("/reject-invite", protect, rejectPartnerInvite);
router.post("/disconnect", protect, disconnectPartner);

export default router;
