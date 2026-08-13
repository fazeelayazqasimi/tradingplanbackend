let mediaStorage = null;
let documentStorage = null;
let videoStorage = null;
let cloudinary = null;

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
const apiKey = process.env.CLOUDINARY_API_KEY || '';
const apiSecret = process.env.CLOUDINARY_API_SECRET || '';

if (cloudName && apiKey && apiSecret) {
  cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  mediaStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'media',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    },
  });

  documentStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'documents',
      resource_type: 'auto',
      allowed_formats: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'jpg', 'jpeg', 'png'],
    },
  });

  videoStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'videos',
      resource_type: 'video',
      allowed_formats: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv'],
      chunk_size: 6000000,
    },
  });
}

module.exports = { cloudinary, mediaStorage, documentStorage, videoStorage };
