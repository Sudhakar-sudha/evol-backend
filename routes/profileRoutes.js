import express from "express";
import {
    updatePersonalDetails,
    getMyProfile,
    editProfile,
} from "../controllers/profileController.js";
import upload from "../middleware/profileUpload.js";

const router = express.Router();

router.put("/profile", updatePersonalDetails);
router.get("/we", getMyProfile);

router.patch("/edit-profile", upload.single("avatar"), editProfile);

export default router;
