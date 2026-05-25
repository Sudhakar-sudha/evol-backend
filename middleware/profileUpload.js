import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

// Cloudinary storage config
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "Evol", // store inside LES_Tutor folder
    resource_type: "image",

    // keep unique file name
    public_id: `profile-${Date.now()}`,

    // auto optimize
    transformation: [
      {
        width: 800,
        height: 800,
        crop: "limit",
      },
      {
        quality: "auto:best",
      },
      {
        fetch_format: "auto",
      },
    ],
  }),
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

// Multer upload config
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

export default upload;