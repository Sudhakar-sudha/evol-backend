import User from "../modals/User.js";
import Message from "../modals/Message.js";
import mongoose from "mongoose";

// Get all messages between two users
export const getMessages = async (req, res) => {
    try {
        const { userId } = req.params; // the other user's ID
        const myId = req.user._id;     // from your existing auth middleware

        const { page = 1, limit = 20 } = req.query;

        if (!myId) {
            return res.status(401).json({ success: false, message: "Unauthorized: no user on request" });
        }

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid userId param" });
        }

        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: userId },
                { senderId: userId, receiverId: myId },
            ],
        })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.status(200).json({ success: true, messages });
    } catch (error) {
        console.error("getMessages error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Get all users except the logged-in user (for sidebar)
export const getUsers = async (req, res) => {
    try {
        const myId = req.user._id;

        if (!myId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const users = await User.find({ _id: { $ne: myId } }).select(
            "-password"
        );

        res.status(200).json({ success: true, users });
    } catch (error) {
        console.error("getUsers error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
