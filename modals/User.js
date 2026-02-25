import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
            required: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            index: true,
        },

        password: {
            type: String,
            default: null,
            select: false,
        },

        googleId: {
            type: String,
            default: null,
        },

        provider: {
            type: String,
            enum: ["local", "google"],
            default: "local",
        },

        avatar: {
            type: String,
            default: "",
        },

        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },

        isVerified: {
            type: Boolean,
            default: false,
        },

        gender: {
            type: String,
            enum: ["male", "female"],
            required: false,
        },

        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        device: {
            deviceId: String,
            platform: {
                type: String,
                enum: ["android", "ios"],
            },
            fcmToken: String,
            appVersion: String,
            lastActiveAt: Date,
        },

        status: {
            type: String,
            enum: ["online", "offline"],
            default: "offline",
        },

        lastSeen: Date,

        refreshToken: {
            type: String,
            select: false,
        },

        resetPasswordToken: {
            type: String,
            index: true,
        },
        resetPasswordExpire: Date,
        resetPasswordAttempts: {
            type: Number,
            default: 0,
        },
        resetPasswordVerified: {
            type: Boolean,
            default: false,
        },
        resetSessionToken: String,
    },
    { timestamps: true }
);

/* 🔐 Hash password (local only) */
userSchema.pre("save", async function () {
    if (!this.password || !this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10);
});


/* 🔑 Compare password */
userSchema.methods.comparePassword = function (enteredPassword) {
    if (!this.password) return false;
    return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);
