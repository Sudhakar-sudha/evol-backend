import Message from "../modals/Message.js";
import User from "../modals/User.js";
import admin from "../config/firebase.js";

// Map: userId (string) → socketId
const onlineUsers = new Map();

const socketToUser = new Map();

const chatSocket = (io) => {
  io.on("connection", (socket) => {
    // console.log("Socket connected:", socket.id);


    // ─── Join with userId ───────────────────────────────────────
    socket.on("join", (userId) => {
      onlineUsers.set(userId, socket.id);
      socketToUser.set(socket.id, userId);

      // Broadcast updated online list to everyone
      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
      // console.log(`User ${userId} joined. Online:`, [...onlineUsers.keys()]);
    });

    // ─── Send Message ────────────────────────────────────────────
    socket.on("sendMessage", async (data) => {
      try {
        const newMessage = await Message.create({
          senderId: data.senderId,
          receiverId: data.receiverId,
          message: data.message,
          type: data.type || "text",
          status: "sent",
        });

        const receiverSocketId = onlineUsers.get(data.receiverId);


        const user = await User.findById(data.receiverId);

        if (receiverSocketId) {
          newMessage.status = "delivered";
          await newMessage.save();

          io.to(receiverSocketId).emit("receiveMessage", newMessage);
        } else {
          //  OFFLINE → PUSH NOTIFICATION

          if (!user?.device?.fcmToken) {
            // console.log("⚠️ No FCM token for user:", data.receiverId);
          } else {
            try {
              await admin.messaging().send({
                token: user.device.fcmToken,
                notification: {
                  title: "New Message 💌",
                  body: data.message?.slice(0, 50) || "Image received",
                },
                data: {
                  senderId: data.senderId.toString(),
                },
              });

              // console.log("✅ Push notification sent");
            } catch (err) {
              console.error("🔥 FCM error:", err.message);
            }
          }
        }


        socket.emit("messageSent", newMessage);
      } catch (error) {
        console.error("sendMessage socket error:", error);
        socket.emit("messageError", { message: "Failed to send message" });
      }
    });

    socket.on("markSeen", async ({ senderId, receiverId }) => {
      try {
        await Message.updateMany(
          {
            senderId,
            receiverId,
            status: { $ne: "seen" },
          },
          {
            status: "seen",
            seenAt: new Date(),
          }
        );

        // notify sender
        const senderSocketId = onlineUsers.get(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit("messagesSeen", {
            senderId,
            receiverId,
          });
        }
      } catch (err) {
        console.error("markSeen error", err);
      }
    });

    // ─── Typing Indicator ────────────────────────────────────────
    socket.on("typing", ({ senderId, receiverId, isTyping }) => {
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing", { senderId, isTyping });
      }
    });

    socket.on("deleteMessage", async ({ messageId, senderId, receiverId }) => {
      try {
        const message = await Message.findById(messageId);

        if (!message) return;

        // Only sender can delete
        if (message.senderId.toString() !== senderId) return;

        await Message.findByIdAndDelete(messageId);

        const receiverSocketId = onlineUsers.get(receiverId);

        // Send delete event to both users
        socket.emit("messageDeleted", { messageId });

        if (receiverSocketId) {
          io.to(receiverSocketId).emit("messageDeleted", { messageId });
        }
      } catch (err) {
        console.error("deleteMessage error:", err);
      }
    });

    // ─── Disconnect ──────────────────────────────────────────────
    socket.on("disconnect", () => {
      const userId = socketToUser.get(socket.id);

      if (userId) {
        onlineUsers.delete(userId);
        socketToUser.delete(socket.id);
      }

      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
      // console.log("Socket disconnected:", socket.id);
    });

  });
};

export default chatSocket;