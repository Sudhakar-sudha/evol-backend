import express from "express";
import {
    invitePartner,
    getPendingInvite,
    acceptPartnerInvite,
    rejectPartnerInvite,
    disconnectPartner
} from "../controllers/InviteController.js";

const router = express.Router();

router.post("/invite", invitePartner);
router.get("/pending-invite", getPendingInvite);
router.post("/accept-invite", acceptPartnerInvite);
router.post("/reject-invite", rejectPartnerInvite);
router.post("/disconnect", disconnectPartner);

export default router;
