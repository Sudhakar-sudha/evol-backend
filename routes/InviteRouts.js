import express from "express";
import { invitePartner, acceptPartnerInvite, handleInviteRedirect , disconnectPartner} from "../controllers/InviteController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();


router.post("/invite-partner", protect, invitePartner);
router.post("/accept-partner", protect, acceptPartnerInvite);
router.get("/connect/:token", handleInviteRedirect);
router.delete("/disconnect-partner", protect, disconnectPartner);


export default router;
