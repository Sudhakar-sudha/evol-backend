import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import User from "../modals/User.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateToken.js";
import fetch from "node-fetch";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* ======================================================
   GOOGLE LOGIN
====================================================== */
export const googleLogin = async (req, res) => {
  try {
    const { token, info } = req.body;
    const { deviceId, platform, fcmToken, appVersion } = info || {};

    if (!token || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "Token and Device ID are required",
      });
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { name, email, picture, sub } = ticket.getPayload();
    const normalizedEmail = email.toLowerCase();

    let user = await User.findOne({ email: normalizedEmail })
      .populate("partnerId", "name gender avatar");

    if (!user) {
      user = await User.create({
        name,
        email: normalizedEmail,
        googleId: sub,
        avatar: picture,
        provider: "google",
        role: "user",
        isVerified: true,
        device: {
          deviceId,
          platform,
          fcmToken,
          appVersion,
          lastActiveAt: new Date(),
        },
      });
    }

    if (user.provider === "local" && !user.googleId) {
      user.googleId = sub;
      user.provider = "google";
    }


    if (user.device?.deviceId && user.device.deviceId !== deviceId) {
      return res.status(403).json({
        success: false,
        message: "Account already logged in on another device",
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    user.device = {
      deviceId,
      platform,
      fcmToken,
      appVersion,
      lastActiveAt: new Date(),
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: "Google login successful",
      data: {
        accessToken,
        refreshToken,
        user: {
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
      },
    });
  } catch (error) {
    console.error("Google login error", error);
    res.status(401).json({
      success: false,
      message: "Google authentication failed",
    });
  }
};

/* ======================================================
   REGISTER
====================================================== */
export const register = async (req, res) => {
  try {
    const { name, email, password, info } = req.body;
    const { deviceId, platform, fcmToken, appVersion } = info || {};

    if (!name || !email || !password || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const normalizedEmail = email.toLowerCase();

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const createdUser = await User.create({
      name,
      email: normalizedEmail,
      password,
      provider: "local",
      isVerified: false,
      device: {
        deviceId,
        platform,
        fcmToken,
        appVersion,
        lastActiveAt: new Date(),
      },
    });

    const user = await User.findById(createdUser._id)
      .populate("partnerId", "name gender avatar");


    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    await user.save();

    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        accessToken,
        refreshToken,
        user: {
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
      },
    });
  } catch (error) {
    console.error("Registration error", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* ======================================================
   LOGIN
====================================================== */
export const login = async (req, res) => {
  try {
    const { email, password, info } = req.body;
    const { deviceId, platform, fcmToken, appVersion } = info || {};

    if (!email || !password || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "Email, password and device ID are required",
      });
    }

    const normalizedEmail = email.toLowerCase();

    const user = await User.findOne({ email: normalizedEmail })
      .select("+password")
      .populate("partnerId", "name gender avatar");

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (user.provider === "google" && !user.password) {
      return res.status(409).json({
        success: false,
        message: "Use Google login for this account",
      });
    }

    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.device?.deviceId && user.device.deviceId !== deviceId) {
      return res.status(403).json({
        success: false,
        message: "Account already logged in on another device",
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    user.device = {
      deviceId,
      platform,
      fcmToken,
      appVersion,
      lastActiveAt: new Date(),
    };

    await user.save();


    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        refreshToken,
        user: {
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
      },
    });
  } catch (error) {
    console.error("Login error", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ======================================================
   LOGOUT
====================================================== */
export const logout = async (req, res) => {
  try {
    const refreshToken = req.headers["x-refresh-token"];
    if (!refreshToken) {
      return res.status(200).json({
        success: true,
        message: "Logged out",
      });
    }

    const hashed = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    await User.updateOne(
      { _id: req.user.id, refreshToken: hashed },
      { $unset: { refreshToken: 1, device: 1 } }
    );

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


export const sendOTPEmail = async (email, otp) => {
  await fetch("https://email-service-chi-lemon.vercel.app/send-mail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: email,
      subject: "Your OTP for Password Reset",
      message: `
        <p>Your OTP for password reset is:</p>
        <h2>${otp}</h2>
        <p>This OTP is valid for <strong>5 minutes</strong>.</p>
      `,
    }),
  });
};


export const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    user.resetPasswordExpire = Date.now() + 5 * 60 * 1000;
    user.resetPasswordAttempts = 0;
    user.resetPasswordVerified = false;
    user.resetSessionToken = undefined;

    await user.save();
    await sendOTPEmail(email, otp);

    res.json({
      success: true,
      message: "OTP sent to email",
    });
  } catch (err) {
    console.error("Forgot password error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const verifyResetOTP = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase();
    const { otp } = req.body;

    const MAX_OTP_ATTEMPTS = 5;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
      });
    }

    if (user.resetPasswordAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "OTP attempts exceeded. Please resend OTP.",
      });
    }

    const hashedOtp = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    if (
      user.resetPasswordToken !== hashedOtp ||
      user.resetPasswordExpire < Date.now()
    ) {
      user.resetPasswordAttempts += 1;
      await user.save();

      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    user.resetPasswordVerified = true;
    user.resetSessionToken = crypto.randomBytes(32).toString("hex");
    user.isVerified = true;

    await user.save();

    res.json({
      success: true,
      message: "OTP verified successfully",
      resetSessionToken: user.resetSessionToken,
    });
  } catch (err) {
    console.error("Verify OTP error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const changePasswordAfterOTP = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase();
    const { newPassword, resetSessionToken } = req.body;

    const user = await User.findOne({
      email,
      resetSessionToken,
      resetPasswordVerified: true,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized request",
      });
    }

    // check if password already exists
    const isFirstTimePasswordSet = !user.password;
    // Set new password (pre-save hook will hash)
    user.password = newPassword;

    // Clear reset state
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.resetPasswordAttempts = 0;
    user.resetPasswordVerified = false;
    user.resetSessionToken = undefined;

    // Logout from all devices
    user.refreshToken = undefined;
    user.device = undefined;

    await user.save();
    // message based on condition
    const subject = isFirstTimePasswordSet
      ? "Password Set Successfully"
      : "Password Changed Successfully";

    const message = isFirstTimePasswordSet
      ? `
        <p>Your password has been set successfully.</p>
        <p>You can now login using your password.</p>
      `
      : `
        <p>Your password has been changed successfully.</p>
        <p>If this wasn’t you, please contact support immediately.</p>
      `;

    await fetch("https://email-service-chi-lemon.vercel.app/send-mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: email,
        subject,
        message,
      }),
    });

    res.json({
      success: true,
      message: isFirstTimePasswordSet
        ? "Password set successfully"
        : "Password changed successfully",
    });
  } catch (err) {
    console.error("Error changing password:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const resendResetOTP = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    user.resetPasswordExpire = Date.now() + 5 * 60 * 1000;
    user.resetPasswordAttempts = 0;
    user.resetPasswordVerified = false;
    user.resetSessionToken = undefined;

    await user.save();
    await sendOTPEmail(email, otp);

    res.json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (err) {
    console.error("Resend OTP error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
