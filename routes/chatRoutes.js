import express from "express";
import {
    getMessages,
    getUsers
} from "../controllers/chatController.js";

const router = express.Router();


router.get("/users",  getUsers);
router.get("/messages/:userId",  getMessages);

export default router;