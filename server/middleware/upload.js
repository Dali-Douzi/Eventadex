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
 *  - restricts to image MIME types
 *  - returns clean JSON errors instead of Express default HTML
 *  No file-size limit is enforced — Cloudinary will reject files it cannot
 *  process and the server has plenty of memory headroom for typical images.
 */
function makeUpload(fieldName) {
  const upload = multer({
    storage:    multer.memoryStorage(),
    fileFilter: imageFilter,
  }).single(fieldName);

  return function (req, res, next) {
    upload(req, res, (err) => {
      if (!err) return next();
      res.status(400).json({ message: err.message || 'Upload failed' });
    });
  };
}

const handleLogoUpload       = makeUpload('logo');
const handleBadgeBgUpload    = makeUpload('background');
const handleBannerUpload     = makeUpload('image');
const handleEmailImageUpload = makeUpload('image');

// ── Excel / CSV import upload (up to 10 MB, spreadsheet MIME types) ───────────
const SPREADSHEET_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
  'text/csv',                                                           // .csv
  'application/csv',
  'text/plain',  // some OS send .csv as text/plain
]);

const spreadsheetFilter = (_req, file, cb) => {
  const ok = SPREADSHEET_MIMES.has(file.mimetype)
    || /\.(xlsx|xls|csv)$/i.test(file.originalname);
  if (ok) return cb(null, true);
  cb(new Error('Only Excel (.xlsx, .xls) or CSV files are allowed'));
};

const _importUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: spreadsheetFilter,
}).single('file');

function handleImportUpload(req, res, next) {
  _importUpload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File too large — maximum size is 10 MB.' });
    }
    res.status(400).json({ message: err.message || 'Upload failed' });
  });
}

module.exports = {
  makeUpload,
  handleLogoUpload,
  handleBadgeBgUpload,
  handleBannerUpload,
  handleEmailImageUpload,
  handleImportUpload,
};
