const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { mediaStorage } = require("../config/cloudinary");

const useCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

['uploads/media', 'uploads/avatars', 'uploads/courses', 'uploads/resources', 'uploads/branding'].forEach(dir => {
  const p = path.join(__dirname, '..', dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = "uploads/resources";

    if (file.fieldname === "avatar") {
      folder = "uploads/avatars";
    } else if (file.fieldname === "thumbnail" || file.fieldname === "courseImage" || file.fieldname === "courseThumbnail") {
      folder = "uploads/courses";
    }

    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const imageFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedDocTypes = /pdf|doc|docx|ppt|pptx|xls|xlsx|txt/;

  const extname = allowedImageTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const extnameDoc = allowedDocTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = file.mimetype.startsWith("image/");

  if (
    (file.fieldname === "avatar" || file.fieldname === "thumbnail") &&
    extname &&
    mimetype
  ) {
    return cb(null, true);
  }

  if (
    (file.fieldname === "resource" || file.fieldname === "document") &&
    extnameDoc
  ) {
    return cb(null, true);
  }

  if (
    (file.fieldname === "courseImage" || file.fieldname === "courseThumbnail") &&
    extname &&
    mimetype
  ) {
    return cb(null, true);
  }

  cb(new Error("File type not supported"), false);
};

const uploadAvatar = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const uploadCourse = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const uploadResource = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const uploadLogo = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/branding"),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `logo${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith("image/");
    if (extname && mimetype) return cb(null, true);
    cb(new Error("Only image files are allowed"), false);
  },
});

const uploadMedia = multer({
  storage: useCloudinary ? mediaStorage : multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/media"),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith("image/");
    if (extname && mimetype) return cb(null, true);
    cb(new Error("Only image files (jpeg, jpg, png, gif, webp) are allowed"), false);
  },
});

module.exports = { uploadAvatar, uploadCourse, uploadResource, uploadLogo, uploadMedia };
