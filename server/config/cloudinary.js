'use strict';

const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a buffer to Cloudinary and return the full result object.
 *   result.secure_url — CDN URL to store in MongoDB
 *   result.public_id  — identifier for future deletions / transformations
 *
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {object} options - Cloudinary upload options (folder, resource_type, etc.)
 */
function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      { resource_type: 'image', ...options },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
    Readable.from(buffer).pipe(upload);
  });
}

/**
 * Delete an asset from Cloudinary by public_id.
 * Safe to call with falsy values — simply no-ops.
 */
async function deleteFromCloudinary(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('[cloudinary] delete failed:', err.message);
  }
}

module.exports = { uploadToCloudinary, deleteFromCloudinary };
