'use strict';

const router = require('express').Router();

const {
  getFormConfig,
  createPaymentIntent,
  register,
  getRegistrantDetail,
  getVipFormConfig,
  registerVip,
  resendConfirmation,
} = require('../controllers/publicController');

const { registrationLimiter }                    = require('../middleware/rateLimits');
const { registerValidators, validate, idParam }  = require('../middleware/validate');
const { param }                                  = require('express-validator');

// ── No authentication on any of these routes ─────────────────────────────────

/**
 * GET /api/public/:orgSlug
 * Returns everything the registration form needs to render:
 *   event details, pageConfig, sessions (with remaining capacity), lookups
 * Only succeeds if org.status === 'active' AND event.status === 'published'.
 */
router.get('/:orgSlug', getFormConfig);

/**
 * POST /api/public/:orgSlug/create-payment-intent
 * Creates a Stripe PaymentIntent for the event's ticket price.
 * Returns { clientSecret }. Only relevant when event.paymentEnabled is true.
 */
router.post('/:orgSlug/create-payment-intent', createPaymentIntent);

/**
 * POST /api/public/:orgSlug/register
 * Rate-limited: max 10 requests / IP / 15 min.
 * Validates required fields, optionally verifies Stripe payment,
 * checks session capacity, creates a Registrant + QR code, fires confirmation email.
 * Returns { success, registrantId, qrCode }.
 */
router.post(
  '/:orgSlug/register',
  registrationLimiter,
  registerValidators,
  validate,
  register
);

/**
 * GET /api/public/:orgSlug/registrant/:id
 * Returns registrant detail + freshly-generated qrCodeImage.
 */
router.get(
  '/:orgSlug/registrant/:id',
  [param('id').isMongoId().withMessage('id must be a valid ID'), validate],
  getRegistrantDetail
);

router.post(
  '/:orgSlug/registrant/:id/resend',
  [param('id').isMongoId().withMessage('id must be a valid ID'), validate],
  resendConfirmation
);

/**
 * GET /api/public/:orgSlug/vip
 * Returns VIP form config (VipPageConfig, event details, lookups).
 */
router.get('/:orgSlug/vip', getVipFormConfig);

/**
 * POST /api/public/:orgSlug/vip/register
 * Rate-limited VIP registration. Saves to VipRegistrant collection.
 * Returns { success, registrantId, qrCode, badgeType: 'vip' }.
 */
router.post(
  '/:orgSlug/vip/register',
  registrationLimiter,
  registerValidators,
  validate,
  registerVip
);

module.exports = router;
