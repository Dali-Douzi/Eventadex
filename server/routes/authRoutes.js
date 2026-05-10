'use strict';

const router = require('express').Router();
const { masterLogin, adminLogin, getMe } = require('../controllers/authController');
const { verifyToken }                    = require('../middleware/auth');
const { loginLimiter }                   = require('../middleware/rateLimits');
const { loginValidators, validate }      = require('../middleware/validate');

router.post('/master/login', loginLimiter, loginValidators, validate, masterLogin);
router.post('/admin/login',  loginLimiter, loginValidators, validate, adminLogin);
router.get ('/me',           verifyToken, getMe);

module.exports = router;
