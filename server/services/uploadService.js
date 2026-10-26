const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

// Check if external cloud storage is configured
function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

// Initialize Cloudinary if credentials are present
if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('[Storage Service] Cloudinary External Storage initialized.');
} else {
  console.log('[Storage Service] Cloudinary keys not found in .env. Using Local Uploads Fallback (/uploads).');
}

/**
 * Upload an image buffer or base64 string to external Cloudinary or local disk
 * @param {Buffer|string} fileSource - Buffer from multer or base64 data string
 * @param {string} folder - 'students' | 'avatars'
 * @param {string} originalExt - '.jpg' | '.png' etc.
 * @returns {Promise<string>} Public HTTPS or local URL to save in MongoDB
 */
async function uploadImage(fileSource, folder = 'students', originalExt = '.jpg') {
  const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'general';

  // 1. CLOUDINARY EXTERNAL CLOUD STORAGE
  if (isCloudinaryConfigured()) {
    try {
      if (Buffer.isBuffer(fileSource)) {
        return await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: `registerly/${sanitizedFolder}`,
              resource_type: 'image',
              transformation: [
                { quality: 'auto:good' },
                { fetch_format: 'auto' }
              ]
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result.secure_url);
            }
          );
          uploadStream.end(fileSource);
        });
      } else if (typeof fileSource === 'string') {
        const result = await cloudinary.uploader.upload(fileSource, {
          folder: `registerly/${sanitizedFolder}`,
          resource_type: 'image',
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' }
          ]
        });
        return result.secure_url;
      }
    } catch (err) {
      console.error('[Cloudinary Upload Error]', err);
      // Fall through to local fallback if Cloudinary call fails
    }
  }

  // 2. LOCAL DISK STORAGE FALLBACK (offline / local development)
  const uploadsDir = path.join(__dirname, '../../public/uploads', sanitizedFolder);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const ext = originalExt.startsWith('.') ? originalExt : `.${originalExt}`;
  const filename = `${sanitizedFolder}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const targetPath = path.join(uploadsDir, filename);

  if (Buffer.isBuffer(fileSource)) {
    await fs.promises.writeFile(targetPath, fileSource);
  } else if (typeof fileSource === 'string') {
    // Handle base64 data URL
    const matches = fileSource.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches[2]) {
      const buffer = Buffer.from(matches[2], 'base64');
      await fs.promises.writeFile(targetPath, buffer);
    } else {
      await fs.promises.writeFile(targetPath, fileSource);
    }
  }

  // Returns relative URL accessible through express.static('/uploads')
  return `/uploads/${sanitizedFolder}/${filename}`;
}

module.exports = {
  isCloudinaryConfigured,
  uploadImage
};
