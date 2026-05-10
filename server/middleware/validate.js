'use strict';

/**
 * Reusable express-validator chains + a runner middleware.
 *
 * Usage in a route file:
 *   const { validate, loginValidators } = require('../middleware/validate');
 *   router.post('/login', loginValidators, validate, handler);
 */

const { body, param, validationResult } = require('express-validator');

// ─── Runner ───────────────────────────────────────────────────────────────────

/**
 * Runs validationResult and short-circuits with 422 when any check fails.
 * Returns only the first error message to keep the response lean.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array({ onlyFirstError: true })[0];
    return res.status(422).json({
      success: false,
      error:   first.msg,
      field:   first.path,
    });
  }
  next();
}

// ─── Reusable field validators ────────────────────────────────────────────────

const emailField   = (field = 'email') =>
  body(field)
    .trim()
    .isEmail()
    .withMessage('A valid email address is required')
    .normalizeEmail();

const requiredStr  = (field, label) =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage(`${label || field} is required`);

const mongoIdParam = (name = 'id') =>
  param(name)
    .isMongoId()
    .withMessage(`${name} must be a valid ID`);

// ─── Route-specific validator arrays ─────────────────────────────────────────

/** POST /api/auth/master/login  &  POST /api/auth/admin/login */
const loginValidators = [
  emailField('email'),
  requiredStr('password', 'Password'),
];

/** POST /api/public/:orgSlug/register */
const registerValidators = [
  requiredStr('firstName', 'First name'),
  requiredStr('lastName',  'Last name'),
  emailField('email'),
  body('sessionId')
    .trim()
    .isMongoId()
    .withMessage('A valid session ID is required'),
];

/** POST /api/admin/event/sessions */
const addSessionValidators = [
  requiredStr('name', 'Session name'),
  body('date')
    .notEmpty()
    .withMessage('Session date is required')
    .isISO8601()
    .withMessage('Session date must be a valid date (YYYY-MM-DD)'),
  body('capacity')
    .notEmpty()
    .withMessage('Capacity is required')
    .isInt({ min: 1 })
    .withMessage('Capacity must be a positive integer'),
  body('waitlistCapacity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Waitlist capacity must be a non-negative integer'),
];

/** PATCH /api/admin/event/payment */
const paymentValidators = [
  body('paymentEnabled')
    .optional()
    .isBoolean()
    .withMessage('paymentEnabled must be a boolean'),
  body('ticketPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Ticket price must be a non-negative number'),
  body('currency')
    .optional()
    .trim()
    .matches(/^[A-Z]{3}$/)
    .withMessage('Currency must be a 3-letter ISO code (e.g. USD)'),
];

/** Routes with :id or :sessionId path params */
const idParam        = mongoIdParam('id');
const sessionIdParam = mongoIdParam('sessionId');

module.exports = {
  validate,
  loginValidators,
  registerValidators,
  addSessionValidators,
  paymentValidators,
  idParam,
  sessionIdParam,
};
