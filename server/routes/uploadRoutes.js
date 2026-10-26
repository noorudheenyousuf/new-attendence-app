const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const uploadService = require('../services/uploadService');

// In-memory Multer storage for streaming to Cloudinary or writing to local disk
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept image files
    if (file.mimetype.startsWith('image/')) {
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
 * Upload a photo file (multipart/form-data) OR base64 data string
 */
router.post('/photo', upload.single('photo'), async (req, res) => {
  try {
    const folder = req.body.folder || 'students';
    let fileSource = null;
    let ext = '.jpg';

    // 1. Multipart form upload via Multer
    if (req.file) {
      fileSource = req.file.buffer;
      ext = path.extname(req.file.originalname) || '.jpg';
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

module.exports = router;
