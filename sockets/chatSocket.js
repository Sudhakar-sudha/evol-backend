import Message from "../modals/Message.js";
import User from "../modals/User.js";
import admin from "../config/firebase.js";

// userId (string) → socketId
const onlineUsers = new Map();
// socketId → userId (string)
const socketToUser = new Map();

const chatSocket = (io) => {
  io.on("connection", (socket) => {
    // Use handshake userId if client sent it (auth: { userId })
    const handshakeUserId =
      socket.handshake?.auth?.userId || socket.handshake?.query?.userId;

    if (handshakeUserId) {
      const uid = String(handshakeUserId);
      onlineUsers.set(uid, socket.id);
      socketToUser.set(socket.id, uid);
      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    }

    // ─── Join with userId ───────────────────────────────────────
    socket.on("join", (userId) => {
      if (!userId) return;
      const uid = String(userId);
      onlineUsers.set(uid, socket.id);
      socketToUser.set(socket.id, uid);
      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    });

    // ─── Send Message ────────────────────────────────────────────
    socket.on("sendMessage", async (data) => {
      try {
        // Trust the socket's identity, not the client-supplied senderId
        const senderId = socketToUser.get(socket.id) || String(data.senderId);
        const receiverId = String(data.receiverId);
        const type = data.type || "text";

        if (!data.message || !receiverId) {
          socket.emit("messageError", { message: "Invalid message" });
          return;
        }

        const newMessage = await Message.create({
          senderId,
          receiverId,
          message: data.message,
          type,
          status: "sent",
        });

        const receiverSocketId = onlineUsers.get(receiverId);

        if (receiverSocketId) {
          newMessage.status = "delivered";
          await newMessage.save();
        }

        // Payload with _tempId so the sender's UI replaces the optimistic bubble
        const payload = { ...newMessage.toObject(), _tempId: data._tempId };

        // 1) Confirm to sender immediately
        socket.emit("messageSent", payload);

        // 2) Deliver to receiver (only receiver, never back to sender)
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receiveMessage", payload);
        } else {
          // OFFLINE → push notification (don't block the sender)
          try {
            const user = await User.findById(receiverId);
            if (user?.device?.fcmToken) {
              await admin.messaging().send({
                token: user.device.fcmToken,
                notification: {
                  title: "New Message 💌",
                  body:
                    type === "image"
                      ? "📷 Photo"
                      : (data.message || "").slice(0, 50),
                },
                data: { senderId: String(senderId) },
              });
            }
          } catch (err) {
            console.error("🔥 FCM error:", err.message);
          }
        }
      } catch (error) {
        console.error("sendMessage socket error:", error);
        socket.emit("messageError", { message: "Failed to send message" });
      }
    });

    // ─── Mark Seen ───────────────────────────────────────────────
    // payload: { senderId: <original sender>, receiverId: <viewer> }
    socket.on("markSeen", async ({ senderId, receiverId }) => {
      try {
        const result = await Message.updateMany(
          { senderId, receiverId, status: { $ne: "seen" } },
          { status: "seen", seenAt: new Date() }
        );

        if (result.modifiedCount > 0) {
          const senderSocketId = onlineUsers.get(String(senderId));
          if (senderSocketId) {
            // receiverId here = the person who saw the messages
            io.to(senderSocketId).emit("messagesSeen", { senderId, receiverId });
          }
        }
      } catch (err) {
        console.error("markSeen error", err);
      }
    });

    // ─── Typing Indicator ────────────────────────────────────────
    socket.on("typing", ({ senderId, receiverId, isTyping }) => {
      const receiverSocketId = onlineUsers.get(String(receiverId));
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing", { senderId, isTyping });
      }
    });

    // ─── Delete Message ──────────────────────────────────────────
    socket.on("deleteMessage", async ({ messageId, receiverId }) => {
      try {
        const senderId = socketToUser.get(socket.id);
        const message = await Message.findById(messageId);
        if (!message) return;

        // Only the sender can delete
        if (message.senderId.toString() !== String(senderId)) return;

        await Message.findByIdAndDelete(messageId);

        socket.emit("messageDeleted", { messageId });

        const receiverSocketId = onlineUsers.get(String(receiverId));
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
      socketToUser.delete(socket.id);

      // Only remove if THIS socket is still the user's current one
      // (prevents a stale disconnect from marking a reconnected user offline)
      if (userId && onlineUsers.get(userId) === socket.id) {
        onlineUsers.delete(userId);
      }

      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    });
  });
};

export default chatSocket;