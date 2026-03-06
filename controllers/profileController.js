import User from "../modals/User.js";

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

        const user = await User.findById(userId);

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
                gender: user.gender,
                dateOfBirth: user.dateOfBirth,
                loveStartDate: user.loveStartDate,
                age: user.age, // since you auto calculate
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
            data: user,
        });

    } catch (error) {
        console.error("Get Profile Error:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again later.",
        });
    }
};