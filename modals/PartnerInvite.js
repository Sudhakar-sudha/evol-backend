// models/PartnerInvite.js
import mongoose from "mongoose";

const partnerInviteSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  },
  { timestamps: true }
);

// Auto-expire: mark as expired if past expiresAt
partnerInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PartnerInvite = mongoose.model("PartnerInvite", partnerInviteSchema);
export default PartnerInvite;