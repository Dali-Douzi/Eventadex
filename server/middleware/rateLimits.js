'use strict';

const rateLimit = require('express-rate-limit');

// ─── Public registration ──────────────────────────────────────────────────────

/**
 * Applied to POST /api/public/:orgSlug/register
 * Max 10 attempts per IP every 15 minutes — prevents abuse without
 * blocking legitimate users (who rarely submit more than 1–2 forms).
 */
const registrationLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             10,
  standardHeaders: true,            // Return RateLimit-* headers (RFC 6585)
  legacyHeaders:   false,           // Disable X-RateLimit-* legacy headers
  message: {
    success: false,
    error:
      'Too many registration attempts from this IP address. ' +
      'Please wait 15 minutes before trying again.',
  },
  // Use forwarded IP from reverse-proxy (nginx) when present
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
  skip: () => process.env.NODE_ENV === 'test', // don't block automated tests
});

// ─── Login brute-force protection ────────────────────────────────────────────

/**
 * Applied to POST /api/auth/:role/login
 * Max 20 attempts per IP every 15 minutes.
 */
const loginLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error: 'Too many login attempts. Please wait 15 minutes before trying again.',
  },
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
  skip: () => process.env.NODE_ENV === 'test',
});

// ─── Admin API protection ─────────────────────────────────────────────────────

/**
 * Applied to all /api/admin/* routes.
 * Generous limit — legitimate admin use rarely exceeds this.
 * Protects against runaway loops, scrapers, and token-replay attacks.
 */
const adminLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 minute
  max:             300,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { registrationLimiter, loginLimiter, adminLimiter };
