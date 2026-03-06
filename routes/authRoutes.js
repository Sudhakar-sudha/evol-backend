import express from "express";
import {
  googleLogin,
  register,
  login,
  logout,
  forgotPassword,
  verifyResetOTP,
  changePasswordAfterOTP,
  resendResetOTP,
} from "../controllers/authController.js";
import { refreshToken } from "../controllers/refreshTokenController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/refresh", refreshToken);

// Local auth
router.post("/register", register);
router.post("/login", login);
router.post("/logout", protect, logout);

// Google auth
router.post("/google", googleLogin);

// Password reset & OTP verification
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyResetOTP);
router.post("/change-password", changePasswordAfterOTP);
router.post("/resend-otp", resendResetOTP);


export default router;
