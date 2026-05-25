// controllers/partnerInvite.controller.js
import admin from "../config/firebase.js"; // Firebase Admin SDK instance
import User from "../modals/User.js";
import PartnerInvite from "../modals/PartnerInvite.js";
import mongoose from "mongoose";
// ─────────────────────────────────────────────
// Helper: send a push notification via FCM
// ─────────────────────────────────────────────
const sendPushNotification = async ({ fcmToken, title, body, data = {} }) => {
  if (!fcmToken) return; // silently skip if receiver has no token

  const message = {
    token: fcmToken,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: {
      priority: "high",
      notification: { sound: "default", channelId: "partner_invite" },
    },
    apns: {
      payload: {
        aps: { sound: "default", badge: 1 },
      },
    },
  };

  await admin.messaging().send(message);
};

// ─────────────────────────────────────────────
// POST /api/partner/invite
// Sender invites partner by email
// ─────────────────────────────────────────────
export const invitePartner = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { partnerEmail } = req.body;

    // ── Validation ──────────────────────────────
    if (!partnerEmail) {
      return res.status(400).json({
        success: false,
        message: "Partner email is required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(partnerEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    // ── Sender checks ───────────────────────────
    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (sender.partnerId) {
      return res.status(400).json({
        success: false,
        message: "You are already connected with a partner.",
      });
    }

    if (!sender.onboardingSeen) {
      return res.status(400).json({
        success: false,
        message: "Please complete onboarding before inviting a partner.",
      });
    }

    // ── Self-invite guard ────────────────────────
    if (sender.email.toLowerCase() === partnerEmail.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "You cannot invite yourself.",
      });
    }

    // ── Receiver checks ─────────────────────────
    const receiver = await User.findOne({ email: partnerEmail.toLowerCase() });
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "No account found with that email address.",
      });
    }

    if (receiver.partnerId) {
      return res.status(400).json({
        success: false,
        message: "This user is already connected with someone.",
      });
    }

    if (!receiver.onboardingSeen) {
      return res.status(400).json({
        success: false,
        message: "This user has not completed onboarding yet.",
      });
    }

    // ── Duplicate invite guard ───────────────────
    const existingInvite = await PartnerInvite.findOne({
      senderId,
      receiverId: receiver._id,
      status: "pending",
    });

    if (existingInvite) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending invite to this user.",
      });
    }

    // ── Create invite record ─────────────────────
    const invite = await PartnerInvite.create({
      senderId,
      receiverId: receiver._id,
      status: "pending",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // ── Push notification ────────────────────────
    try {
      await sendPushNotification({
        fcmToken: receiver?.device?.fcmToken,
        title: "💕 Partner Invite",
        body: `${sender.name || "Someone"} wants to connect with you on Evol!`,
        data: {
          type: "PARTNER_INVITE",
          inviteId: invite._id.toString(),
          senderName: sender.name || "",
          senderAvatar: sender.avatar || "",
        },
      });
    } catch (pushError) {
      // Invite was saved — don't fail the whole request over a push failure.
      // Log it and let the receiver poll via getPendingInvite instead.
      console.error("Push notification failed:", pushError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Invite sent successfully.",
      inviteId: invite._id,
    });
  } catch (error) {
    console.error("invitePartner error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────
// GET /api/partner/pending-invite
// Receiver fetches their pending invite (if any)
// ─────────────────────────────────────────────
export const getPendingInvite = async (req, res) => {
  try {
    const receiverId = req.user.id;

    const invite = await PartnerInvite.findOne({
      receiverId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    }).populate("senderId", "name avatar email dateOfBirth");

    if (!invite) {
      return res.status(200).json({
        success: true,
        invite: null,
        message: "No pending invite found.",
      });
    }

    return res.status(200).json({
      success: true,
      invite: {
        inviteId: invite._id,
        sender: {
          name: invite.senderId.name,
          avatar: invite.senderId.avatar,
          email: invite.senderId.email,
        },
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
    });
  } catch (error) {
    console.error("getPendingInvite error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────
// POST /api/partner/accept-invite
// Receiver accepts the invite + verifies sender DOB
// ─────────────────────────────────────────────
export const acceptPartnerInvite = async (req, res) => {
  try {
    const receiverId = req.user.id;
    const { inviteId, loverBirthDate } = req.body;

    // ── Validate input ───────────────────────────
    if (!inviteId || !loverBirthDate) {
      return res.status(400).json({
        success: false,
        message: "Invite ID and your partner's birth date are required.",
      });
    }

    // ── Fetch invite ─────────────────────────────
    const invite = await PartnerInvite.findOne({
      _id: inviteId,
      receiverId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (!invite) {
      return res.status(400).json({
        success: false,
        message: "Invite not found, already used, or expired.",
      });
    }

    // ── Prevent self invite acceptance ───────────
    if (invite.senderId.toString() === receiverId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot accept your own invite.",
      });
    }

    // ── Fetch both users ─────────────────────────
    const [sender, receiver] = await Promise.all([
      User.findById(invite.senderId),
      User.findById(receiverId),
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // ── Re-check partner connection status ───────
    if (sender.partnerId) {
      invite.status = "expired";
      await invite.save();

      return res.status(400).json({
        success: false,
        message: "This user is already connected with someone.",
      });
    }

    if (receiver.partnerId) {
      return res.status(400).json({
        success: false,
        message: "You are already connected with someone.",
      });
    }

    // ── Onboarding validation ────────────────────
    if (!sender.onboardingSeen || !receiver.onboardingSeen) {
      return res.status(400).json({
        success: false,
        message: "Both users must complete onboarding before connecting.",
      });
    }

    // ── DOB validation ───────────────────────────
    if (!sender.dateOfBirth) {
      return res.status(400).json({
        success: false,
        message: "Sender birth date is missing.",
      });
    }

    const senderDOB = new Date(sender.dateOfBirth)
      .toISOString()
      .split("T")[0];

    const enteredDOB = new Date(loverBirthDate)
      .toISOString()
      .split("T")[0];

    if (senderDOB !== enteredDOB) {
      return res.status(403).json({
        success: false,
        message: "The birth date you entered does not match your partner's.",
      });
    }

    // ── Final safety check before connecting ─────
    const latestSender = await User.findById(sender._id).select("partnerId");
    const latestReceiver = await User.findById(receiver._id).select("partnerId");

    if (latestSender.partnerId || latestReceiver.partnerId) {
      return res.status(409).json({
        success: false,
        message: "One of the users is already connected.",
      });
    }

    // ── Connect both users ───────────────────────
    sender.partnerId = receiver._id;
    receiver.partnerId = sender._id;

    invite.status = "accepted";

    // ── Save all changes ─────────────────────────
    await Promise.all([
      sender.save(),
      receiver.save(),
      invite.save(),
    ]);

    // ── Expire other pending invites ─────────────
    await PartnerInvite.updateMany(
      {
        _id: { $ne: invite._id },
        status: "pending",
        $or: [
          { senderId: sender._id },
          { receiverId: sender._id },
          { senderId: receiver._id },
          { receiverId: receiver._id },
        ],
      },
      {
        $set: { status: "expired" },
      }
    );

    // ── Push notification ────────────────────────
    try {
      if (sender.fcmToken) {
        await sendPushNotification({
          fcmToken: sender.fcmToken,
          title: "💖 Connected!",
          body: `${receiver.name || "Your partner"
            } accepted your invite on Evol!`,
          data: {
            type: "INVITE_ACCEPTED",
            inviteId: invite._id.toString(),
          },
        });
      }
    } catch (pushError) {
      console.error("Acceptance push failed:", pushError.message);
    }

    // ── Response ─────────────────────────────────
    return res.status(200).json({
      success: true,
      message: "You are now connected ❤️",
      data: {
        id: receiver._id,
        name: receiver.name,
        email: receiver.email,
        avatar: receiver.avatar,
        provider: receiver.provider,
        gender: receiver.gender,
        loveStartDate: receiver.loveStartDate,
        dateOfBirth: receiver.dateOfBirth,

        partner: {
          id: sender._id,
          name: sender.name,
          gender: sender.gender,
          avatar: sender.avatar,
        },
      },
    });
  } catch (error) {
    console.error("acceptPartnerInvite error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

// ─────────────────────────────────────────────
// POST /api/partner/reject-invite
// Receiver rejects the pending invite
// ─────────────────────────────────────────────
export const rejectPartnerInvite = async (req, res) => {
  try {
    const receiverId = req.user.id;
    const { inviteId } = req.body;

    if (!inviteId) {
      return res.status(400).json({
        success: false,
        message: "Invite ID is required.",
      });
    }

    const invite = await PartnerInvite.findOne({
      _id: inviteId,
      receiverId,
      status: "pending",
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: "Invite not found or already handled.",
      });
    }

    invite.status = "rejected";
    await invite.save();

    // Optionally notify sender of rejection (silent — no body text)
    try {
      const sender = await User.findById(invite.senderId).select("fcmToken name");
      if (sender?.fcmToken) {
        await sendPushNotification({
          fcmToken: sender.fcmToken,
          title: "Partner invite update",
          body: "Your partner invite was not accepted.",
          data: {
            type: "INVITE_REJECTED",
            inviteId: invite._id.toString(),
          },
        });
      }
    } catch (pushError) {
      console.error("Rejection push failed:", pushError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Invite rejected.",
    });
  } catch (error) {
    console.error("rejectPartnerInvite error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────
// POST /api/partner/disconnect
// Either user can disconnect from their partner
// ─────────────────────────────────────────────
export const disconnectPartner = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).populate("partnerId", "name gender avatar");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (!user.partnerId) {
      return res.status(400).json({
        success: false,
        message: "You are not connected with any partner.",
      });
    }

    const partner = await User.findById(user.partnerId);

    user.partnerId = null;
    user.loveStartDate = null;

    if (partner) {
      partner.partnerId = null;
      partner.loveStartDate = null;
      await partner.save();

      // Notify the other user
      try {
        await sendPushNotification({
          fcmToken: partner.fcmToken,
          title: "Partner disconnected",
          body: "Your partner has disconnected on Evol.",
          data: { type: "PARTNER_DISCONNECTED" },
        });
      } catch (pushError) {
        console.error("Disconnect push failed:", pushError.message);
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Partner disconnected successfully.",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
        gender: user.gender,
        loveStartDate: user.loveStartDate,
        dateOfBirth: user.dateOfBirth,
        partner: user.partnerId
          ? {
            id: user.partnerId._id,
            name: user.partnerId.name,
            gender: user.partnerId.gender,
            avatar: user.partnerId.avatar,
          }
          : null,
      },
    });
  } catch (error) {
    console.error("disconnectPartner error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};