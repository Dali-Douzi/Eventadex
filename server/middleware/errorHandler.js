'use strict';

/**
 * Global Express error handler — mount last in index.js after all routes.
 *
 * Receives errors thrown or passed via next(err) from any middleware / route.
 * Always returns JSON so clients never see an HTML error page.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Log full stack in development; just the message in production
  if (process.env.NODE_ENV !== 'production') {
    console.error('[errorHandler]', err);
  } else {
    console.error('[errorHandler]', err.message);
  }

  // ── Mongoose validation error ──────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message).join('; ');
    return res.status(422).json({ success: false, error: messages });
  }

  // ── Mongoose duplicate-key error ───────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: `A record with this ${field} already exists.`,
    });
  }

  // ── Mongoose CastError (invalid ObjectId in a query) ──────────────────────
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, error: `Invalid value for field: ${err.path}` });
  }

  // ── JWT errors ─────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, error: 'Invalid authentication token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: 'Authentication token has expired.' });
  }

  // ── Multer / file-upload errors ───────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'Uploaded file is too large.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, error: 'Unexpected file field in upload.' });
  }

  // ── Explicit HTTP status on the error object ──────────────────────────────
  const status = err.status || err.statusCode;
  if (status && status >= 400 && status < 600) {
    return res.status(status).json({ success: false, error: err.message });
  }

  // ── Everything else — 500 ─────────────────────────────────────────────────
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected server error occurred. Please try again later.'
      : (err.message || 'Internal server error');

  res.status(500).json({ success: false, error: message });
}

module.exports = errorHandler;
