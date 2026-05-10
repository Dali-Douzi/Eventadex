'use strict';

const multer = require('multer');

// ── Shared image file filter ──────────────────────────────────────────────────
const imageFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) return cb(null, true);
  cb(new Error('Only image files are allowed'));
};

/**
 * Build a multer middleware that:
 *  - buffers the file in memory (Cloudinary receives the buffer)
 *  - enforces a per-upload size limit
 *  - restricts to image MIME types
 *  - returns clean JSON errors instead of Express default HTML
 */
function makeUpload(fieldName, limitMB) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: limitMB * 1024 * 1024 },
    fileFilter: imageFilter,
  }).single(fieldName);

  return function (req, res, next) {
    upload(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          message: `File too large — maximum size is ${limitMB} MB.`,
        });
      }
      res.status(400).json({ message: err.message || 'Upload failed' });
    });
  };
}

const handleLogoUpload       = makeUpload('logo',       2);   // 2 MB
const handleBadgeBgUpload    = makeUpload('background', 5);   // 5 MB
const handleBannerUpload     = makeUpload('image',      5);   // 5 MB
const handleEmailImageUpload = makeUpload('image',      5);   // 5 MB

module.exports = {
  makeUpload,
  handleLogoUpload,
  handleBadgeBgUpload,
  handleBannerUpload,
  handleEmailImageUpload,
};
