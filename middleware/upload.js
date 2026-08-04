const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { mediaStorage } = require("../config/cloudinary");

const useCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

const isServerless = !!process.env.VERCEL;
const UPLOAD_BASE = isServerless ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads');

['media', 'avatars', 'courses', 'resources', 'branding', 'videos'].forEach(dir => {
  const p = path.join(UPLOAD_BASE, dir);
  if (!fs.existsSync(p)) {
    try { fs.mkdirSync(p, { recursive: true }); } catch (e) { console.warn(`[UPLOAD] Could not create ${p}:`, e.message); }
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = path.join(UPLOAD_BASE, 'resources');

    if (file.fieldname === "avatar") {
      folder = path.join(UPLOAD_BASE, 'avatars');
    } else if (file.fieldname === "thumbnail" || file.fieldname === "courseImage" || file.fieldname === "courseThumbnail") {
      folder = path.join(UPLOAD_BASE, 'courses');
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

const brandingFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|svg|ico/;
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype.startsWith("image/") || file.mimetype === 'image/x-icon' || file.mimetype === 'image/vnd.microsoft.icon';
  if (extname && mimetype) return cb(null, true);
  cb(new Error("Only image files (jpeg, jpg, png, gif, webp, svg, ico) are allowed"), false);
};

const uploadBranding = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOAD_BASE, 'branding');
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const type = req.body.type || 'logo';
      const ext = path.extname(file.originalname);
      cb(null, `${type}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: brandingFilter,
});

const uploadMedia = multer({
  storage: useCloudinary ? mediaStorage : multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOAD_BASE, 'media')),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedImage = /jpeg|jpg|png|gif|webp/;
    const allowedVideo = /mp4|webm|mov|avi|mkv|flv|wmv/;
    const extname = allowedImage.test(path.extname(file.originalname).toLowerCase()) || allowedVideo.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
    if (extname && mimetype) return cb(null, true);
    cb(new Error("Only image (jpeg, jpg, png, gif, webp) and video (mp4, webm, mov, avi, mkv, flv, wmv) files are allowed"), false);
  },
});

const uploadDepositScreenshot = multer({
  storage: useCloudinary ? mediaStorage : multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOAD_BASE, 'media')),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `deposit-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
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

const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(UPLOAD_BASE, 'videos'));
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /mp4|webm|mov|avi|mkv|flv|wmv/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith('video/');
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only video files (mp4, webm, mov, avi, mkv, flv, wmv) are allowed'), false);
  },
});

module.exports = { uploadAvatar, uploadCourse, uploadResource, uploadLogo: uploadBranding, uploadBranding, uploadMedia, uploadVideo, uploadDepositScreenshot };
