import User from "../modals/User.js";
import bcrypt from "bcrypt";
import cloudinary from "../config/cloudinary.js";

export const updatePersonalDetails = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access",
            });
        }

        const { gender, dateOfBirth, loveStartDate } = req.body;

        if (!gender && !dateOfBirth && !loveStartDate) {
            return res.status(400).json({
                success: false,
                message: "At least one field is required to update",
            });
        }

        const user = await User.findOne(userId)
            .populate("partnerId", "name gender avatar");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Gender validation
        if (gender) {
            if (!["male", "female"].includes(gender)) {
                return res.status(400).json({
                    success: false,
                    message: "Gender must be either 'male' or 'female'",
                });
            }
            user.gender = gender;
        }

        // DOB validation
        if (dateOfBirth) {
            const dob = new Date(dateOfBirth);

            if (isNaN(dob.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid date of birth format",
                });
            }

            if (dob > new Date()) {
                return res.status(400).json({
                    success: false,
                    message: "Date of birth cannot be in the future",
                });
            }

            user.dateOfBirth = dob;
        }

        // Love date validation
        if (loveStartDate) {
            const loveDate = new Date(loveStartDate);

            if (isNaN(loveDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid love start date format",
                });
            }

            if (loveDate > new Date()) {
                return res.status(400).json({
                    success: false,
                    message: "Love start date cannot be in the future",
                });
            }

            user.loveStartDate = loveDate;
        }
        user.onboardingSeen = true;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Personal details updated successfully",
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
        console.error("Update Personal Details Error:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again later.",
        });
    }
};


export const getMyProfile = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access",
            });
        }

        const user = await User.findById(userId)
            .select("-password -refreshToken -resetPasswordToken -resetSessionToken")
            .populate("partnerId", "name email avatar gender");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "User profile fetched successfully",
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                provider: user.provider,
                gender: user.gender,
                loveStartDate: user.loveStartDate,
                dateOfBirth: user.dateOfBirth,
                onboardingSeen: user.onboardingSeen,
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
        console.error("Get Profile Error:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again later.",
        });
    }
};

/* ─────────────────────────────────────────
   Helper – build a structured API error
   ───────────────────────────────────────── */
const createError = (res, statusCode, message, errors = null) => {
    const payload = { success: false, message };
    if (errors) payload.errors = errors;
    return res.status(statusCode).json(payload);
};

export const editProfile = async (req, res) => {
    try {
        const userId = req.user._id; // set by your auth middleware

        /* ── 1. Pull only the fields we allow to be updated ── */
        const {
            name,
            gender,
            dateOfBirth,
            loveStartDate,
        } = req.body;

        const avatar = req.file?.path;
        /* ── 2. Reject completely empty requests ── */
        const hasPayload = [
            name,
            gender,
            dateOfBirth,
            loveStartDate,
        ].some((v) => v !== undefined && v !== "") || !!avatar;

        if (!hasPayload) {
            return createError(res, 400, "No valid fields provided to update.");
        }

        /* ── 3. Field-level validation ── */
        const validationErrors = {};

        // Name
        if (name !== undefined) {
            if (typeof name !== "string" || name.trim().length < 2) {
                validationErrors.name = "Name must be at least 2 characters.";
            } else if (name.trim().length > 50) {
                validationErrors.name = "Name must be at most 50 characters.";
            }
        }

        // Gender
        if (gender !== undefined && !["male", "female"].includes(gender)) {
            validationErrors.gender = "Gender must be 'male' or 'female'.";
        }

        // Date of birth
        if (dateOfBirth !== undefined) {
            const dob = new Date(dateOfBirth);
            if (isNaN(dob.getTime())) {
                validationErrors.dateOfBirth = "Invalid date of birth.";
            } else if (dob >= new Date()) {
                validationErrors.dateOfBirth =
                    "Date of birth must be in the past.";
            } else {
                // Must be at least 13 years old
                const minAge = new Date();
                minAge.setFullYear(minAge.getFullYear() - 13);
                if (dob > minAge) {
                    validationErrors.dateOfBirth =
                        "You must be at least 13 years old.";
                }
            }
        }

        // Love start date
        if (loveStartDate !== undefined) {
            const lsd = new Date(loveStartDate);
            if (isNaN(lsd.getTime())) {
                validationErrors.loveStartDate = "Invalid love start date.";
            } else if (lsd > new Date()) {
                validationErrors.loveStartDate =
                    "Love start date cannot be in the future.";
            }
        }

        if (Object.keys(validationErrors).length > 0) {
            return createError(
                res,
                422,
                "Validation failed. Please fix the errors and try again.",
                validationErrors
            );
        }

        /* ── 4. Fetch user ── */
        const user = await User.findOne(userId)
            .populate("partnerId", "name gender avatar");

        if (!user) {
            return createError(res, 404, "User not found.");
        }


        /* ── 6. Apply allowed field updates ── */
        if (name !== undefined) user.name = name.trim();
        if (gender !== undefined) user.gender = gender;
        if (dateOfBirth !== undefined) user.dateOfBirth = new Date(dateOfBirth); // age auto-calculated by pre-save hook
        if (loveStartDate !== undefined) user.loveStartDate = new Date(loveStartDate);
        if (req.file) {
            try {
                if (user.avatarPublicId) {
                    await cloudinary.uploader.destroy(user.avatarPublicId);
                }
            } catch (err) {
                console.error("Old image delete failed:", err.message);
            }
            // save new image
            user.avatar = req.file.path;
            user.avatarPublicId = req.file.filename;
        }

        await user.save();

        /* ── 8. Return sanitised user object ── */
        const updatedUser = await User.findById(userId).select(
            "-password -refreshToken -resetPasswordToken -resetPasswordExpire -resetSessionToken -partnerInviteToken"
        );

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                avatar: updatedUser.avatar,
                gender: updatedUser.gender,
                provider: updatedUser.provider,
                loveStartDate: updatedUser.loveStartDate,
                dateOfBirth: updatedUser.dateOfBirth,
                partner: updatedUser.partnerId
                    ? {
                        id: updatedUser.partnerId._id,
                        name: updatedUser.partnerId.name,
                        gender: updatedUser.partnerId.gender,
                        avatar: updatedUser.partnerId.avatar,
                    }
                    : null,
            },
        });
    } catch (error) {
        console.error("[editProfile] error:", error);

        // Mongoose duplicate-key error (e.g., duplicate invitedPartnerEmail)
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern || {})[0] || "field";
            return createError(
                res,
                409,
                `The ${field} you provided is already in use.`
            );
        }

        // Mongoose validation error
        if (error.name === "ValidationError") {
            const errors = {};
            Object.keys(error.errors).forEach((key) => {
                errors[key] = error.errors[key].message;
            });
            return createError(res, 422, "Validation failed.", errors);
        }

        return createError(
            res,
            500,
            "Something went wrong. Please try again later."
        );
    }
};