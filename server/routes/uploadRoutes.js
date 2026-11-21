const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const uploadService = require('../services/uploadService');

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_FOLDERS = new Set(['students', 'avatars', 'logos', 'general']);
const ALLOWED_REMOTE_IMAGE_HOSTS = new Set([
  'res.cloudinary.com',
  'images.unsplash.com',
  'lh3.googleusercontent.com'
]);

const publicPhotoRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many photo uploads from this device. Please wait a few minutes and try again.'
});

// In-memory Multer storage for streaming to Cloudinary or writing to local disk
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept image files with allowed mime types
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP) are allowed'), false);
    }
  }
});

/**
 * GET /api/upload/status
 * Check which storage provider is currently active
 */
router.get('/status', (req, res) => {
  const isCloud = uploadService.isCloudinaryConfigured();
  res.json({
    success: true,
    provider: isCloud ? 'cloudinary' : 'local',
    message: isCloud
      ? 'Cloudinary external cloud storage active'
      : 'Local disk storage fallback active (/uploads)'
  });
});

/**
 * POST /api/upload/photo
 * Upload a photo file (multipart/form-data) OR base64 data string (Authenticated users only)
 */
router.post('/photo', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const rawFolder = String(req.body.folder || 'students').trim().toLowerCase();
    const folder = ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : 'students';
    let fileSource = null;
    let ext = '.jpg';

    // 1. Multipart form upload via Multer
    if (req.file) {
      fileSource = req.file.buffer;
      const rawExt = (path.extname(req.file.originalname) || '').toLowerCase();
      ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : '.jpg';
    } 
    // 2. Base64 payload in JSON body
    else if (req.body.data && typeof req.body.data === 'string') {
      fileSource = req.body.data;
      if (req.body.data.startsWith('data:image/png')) ext = '.png';
      else if (req.body.data.startsWith('data:image/webp')) ext = '.webp';
      else ext = '.jpg';
    } else {
      return res.status(400).json({
        success: false,
        message: 'No photo provided. Send a file with field "photo" or base64 "data".'
      });
    }

    const url = await uploadService.uploadImage(fileSource, folder, ext);
    const isCloud = uploadService.isCloudinaryConfigured();

    res.json({
      success: true,
      url,
      provider: isCloud ? 'cloudinary' : 'local',
      message: 'Photo uploaded successfully'
    });
  } catch (error) {
    console.error('[Upload Route Error]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload photo'
    });
  }
});

/**
 * GET /api/upload/download-proxy?url=...&name=...
 * Streams local or remote image files as an attachment with high clarity
 * Avoids browser CORS / cross-origin blocking when saving to device gallery/downloads
 */
router.get('/download-proxy', authMiddleware, async (req, res) => {
  try {
    const rawUrl = req.query.url;
    let fileName = req.query.name || 'student_photo.jpg';

    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).send('Missing url parameter');
    }

    // Sanitize filename to prevent header injection or directory traversal
    fileName = String(fileName).replace(/[\r\n/\\?%*:|"<>]/g, '_').trim() || 'student_photo.jpg';
    if (!/\.(jpe?g|png|webp|svg)$/i.test(fileName)) {
      fileName += '.jpg';
    }

    // 1. Handle local file paths (/uploads/...)
    if (rawUrl.startsWith('/uploads/')) {
      const sanitizedRelative = path.normalize(rawUrl).replace(/^(\.\.[\/\\])+/, '');
      const localFilePath = path.join(__dirname, '../../public', sanitizedRelative);

      const uploadsDir = path.resolve(__dirname, '../../public/uploads');
      const resolvedPath = path.resolve(localFilePath);
      if (!resolvedPath.startsWith(uploadsDir + path.sep) || !fs.existsSync(resolvedPath)) {
        return res.status(404).send('Photo file not found');
      }

      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.sendFile(resolvedPath);
    }

    // 2. Handle trusted remote HTTPS image URLs only (prevents SSRF)
    if (/^https:\/\//i.test(rawUrl)) {
      let parsedUrl;
      try {
        parsedUrl = new URL(rawUrl);
      } catch (_) {
        return res.status(400).send('Invalid url format');
      }

      const host = parsedUrl.hostname.toLowerCase();
      const isAllowedHost = ALLOWED_REMOTE_IMAGE_HOSTS.has(host) || host.endsWith('.cloudinary.com');
      if (!isAllowedHost || parsedUrl.protocol !== 'https:') {
        return res.status(403).send('Remote image host is not permitted');
      }

      let fetchUrl = parsedUrl.toString();
      // Strip Cloudinary transformations to get original camera-quality master image
      if (host.endsWith('cloudinary.com') && fetchUrl.includes('/image/upload/')) {
        fetchUrl = fetchUrl.replace(/\/image\/upload\/(?:c_[^/]+,)*w_\d+[^/]*\//i, '/image/upload/');
      } else if (host === 'images.unsplash.com') {
        parsedUrl.searchParams.set('w', '1600');
        parsedUrl.searchParams.set('q', '95');
        fetchUrl = parsedUrl.toString();
      }

      const remoteRes = await fetch(fetchUrl);
      if (!remoteRes.ok) {
        return res.status(remoteRes.status).send('Failed to fetch remote image');
      }

      const contentType = (remoteRes.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) {
        return res.status(400).send('Remote resource is not a valid image');
      }
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      const arrayBuffer = await remoteRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.send(buffer);
    }

    return res.status(400).send('Invalid url format');
  } catch (error) {
    console.error('[Download Proxy Error]', error);
    res.status(500).send('Error streaming photo download');
  }
});

/**
 * POST /api/upload/public-student-photo
 * Public photo upload for standalone student self-submission page (images only, max 5MB, students folder)
 */
const publicPhotoUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files (JPEG, PNG, WEBP) are allowed'), false);
  }
});

router.post('/public-student-photo', publicPhotoRateLimit, publicPhotoUpload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo file provided.' });
    }
    const rawExt = (path.extname(req.file.originalname) || '').toLowerCase();
    const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : '.jpg';
    const url = await uploadService.uploadImage(req.file.buffer, 'students', ext);
    const provider = uploadService.isCloudinaryConfigured() ? 'cloudinary' : 'local';
    res.json({
      success: true,
      url,
      provider
    });
  } catch (error) {
    console.error('[Public Photo Upload Error]', error);
    res.status(500).json({ success: false, message: error.message || 'Photo upload failed' });
  }
});

module.exports = router;
