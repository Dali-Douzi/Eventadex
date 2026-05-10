'use strict';

const router = require('express').Router();
const { requireAdmin, requirePermission }    = require('../middleware/auth');
const { handleLogoUpload, handleBadgeBgUpload, handleBannerUpload, handleEmailImageUpload } = require('../middleware/upload');
const {
  getReminderConfig, updateReminderConfig,
  uploadReminderImage, removeReminderImage,
  handleReminderImageUpload,
  sendTestReminderEmail, triggerReminderNow, clearReminderLogs,
} = require('../controllers/reminderController');
const { adminLimiter } = require('../middleware/rateLimits');
const {
  validate,
  addSessionValidators,
  paymentValidators,
  sessionIdParam,
  idParam,
} = require('../middleware/validate');

const {
  getEvent, updateEvent, addSession, updateSession, deleteSession,
  getPageConfig, updatePageConfig, uploadLogo, uploadPageBanner, uploadVipPageBanner,
  getEmailTemplate, updateEmailTemplate, uploadEmailImage, sendTestEmail,
  getVipEmailTemplate, updateVipEmailTemplate, uploadVipEmailImage, sendTestVipEmail,
  updatePaymentSettings,
  listRegistrants, exportRegistrants, searchRegistrant, getRegistrant, checkIn, checkOut,
  getBadgeConfig, updateBadgeConfig, uploadBadgeBackground,
  getVipPageConfig, updateVipPageConfig, uploadVipLogo,
  listVipRegistrants, exportVipRegistrants, searchVipRegistrant, checkInVip, checkOutVip,
  getLookups,
  getDashboardStats,
} = require('../controllers/adminController');

// All admin routes require auth + rate limiting
router.use(adminLimiter);
router.use(requireAdmin);

// ── Dashboard stats ───────────────────────────────────────────────────────────
router.get('/stats', getDashboardStats);

// ── Event ─────────────────────────────────────────────────────────────────────
router.get   ('/event',                                     getEvent);
router.patch ('/event',                                     updateEvent);
router.patch ('/event/payment',  paymentValidators, validate, updatePaymentSettings);
router.post  ('/event/sessions', addSessionValidators, validate, addSession);
router.patch ('/event/sessions/:sessionId', [sessionIdParam, validate], updateSession);
router.delete('/event/sessions/:sessionId', [sessionIdParam, validate], deleteSession);

// ── Page config ───────────────────────────────────────────────────────────────
router.get  ('/page-config',       getPageConfig);
router.put  ('/page-config',       updatePageConfig);
router.post ('/page-config/logo',  handleLogoUpload, uploadLogo);
router.post ('/page-config/banner/:slot',     handleBannerUpload, uploadPageBanner);

// ── Email template ────────────────────────────────────────────────────────────
router.get  ('/email-template',                    getEmailTemplate);
router.put  ('/email-template',                    updateEmailTemplate);
router.post ('/email-template/test',               sendTestEmail);
router.post ('/email-template/image/:type',        handleEmailImageUpload, uploadEmailImage);

// ── VIP Email template ────────────────────────────────────────────────────────
router.get  ('/vip-email-template',                requirePermission('canViewVip'), getVipEmailTemplate);
router.put  ('/vip-email-template',                requirePermission('canViewVip'), updateVipEmailTemplate);
router.post ('/vip-email-template/test',           requirePermission('canViewVip'), sendTestVipEmail);
router.post ('/vip-email-template/image/:type',    requirePermission('canViewVip'), handleEmailImageUpload, uploadVipEmailImage);

// ── Registrants — specific paths before :id to avoid route shadowing ──────────
router.get  ('/registrants/export',                     requirePermission('canExportData'), exportRegistrants);
router.get  ('/registrants/search',                     searchRegistrant);
router.get  ('/registrants',                            listRegistrants);
router.get  ('/registrants/:id',  [idParam, validate],  getRegistrant);
router.patch('/registrants/:id/checkin',  requirePermission('canCheckIn'), [idParam, validate], checkIn);
router.patch('/registrants/:id/checkout', requirePermission('canCheckIn'), [idParam, validate], checkOut);

// ── Badge config ──────────────────────────────────────────────────────────────
router.get ('/badge-config',            getBadgeConfig);
router.put ('/badge-config',            updateBadgeConfig);
router.post('/badge-config/background', handleBadgeBgUpload, uploadBadgeBackground);

// ── VIP page config ───────────────────────────────────────────────────────────
router.get  ('/vip-page-config',       getVipPageConfig);
router.put  ('/vip-page-config',       updateVipPageConfig);
router.post ('/vip-page-config/logo',  handleLogoUpload, uploadVipLogo);
router.post ('/vip-page-config/banner/:slot', handleBannerUpload, uploadVipPageBanner);

// ── VIP registrants ───────────────────────────────────────────────────────────
router.get  ('/vip-registrants/export',                      requirePermission('canViewVip'), requirePermission('canExportData'), exportVipRegistrants);
router.get  ('/vip-registrants/search',                      requirePermission('canViewVip'), searchVipRegistrant);
router.get  ('/vip-registrants',                             requirePermission('canViewVip'), listVipRegistrants);
router.patch('/vip-registrants/:id/checkin',  requirePermission('canCheckIn'), [idParam, validate], checkInVip);
router.patch('/vip-registrants/:id/checkout', requirePermission('canCheckIn'), [idParam, validate], checkOutVip);

// ── Reminder config ───────────────────────────────────────────────────────────
router.get   ('/reminder-config',                   getReminderConfig);
router.put   ('/reminder-config',                   updateReminderConfig);
router.post  ('/reminder-config/test',              sendTestReminderEmail);
router.post  ('/reminder-config/trigger',           triggerReminderNow);
router.delete('/reminder-config/logs',              clearReminderLogs);
router.post  ('/reminder-config/image/:type',       handleReminderImageUpload, uploadReminderImage);
router.delete('/reminder-config/image/:type',       removeReminderImage);

// ── Lookups (read-only) ───────────────────────────────────────────────────────
router.get('/lookups/:type', getLookups);

module.exports = router;
