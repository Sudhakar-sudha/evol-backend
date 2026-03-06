import express from "express";
import {
    updatePersonalDetails,
    getMyProfile,
} from "../controllers/profileController.js";

const router = express.Router();

router.put("/profile", updatePersonalDetails);
router.get("/we", getMyProfile);


export default router;
