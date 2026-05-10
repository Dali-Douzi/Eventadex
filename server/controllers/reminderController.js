'use strict';

const ReminderConfig              = require('../models/ReminderConfig');
const ReminderLog                 = require('../models/ReminderLog');
const Event                       = require('../models/Event');
const PageConfig                  = require('../models/PageConfig');
const { runReminderCheck, formatCountdown, sendReminderEmail } = require('../services/reminderService');
const { uploadToCloudinary }      = require('../config/cloudinary');
const { makeUpload }              = require('../middleware/upload');

// ── multer middleware (re-exported so the router can apply it) ────────────────
const handleReminderImageUpload = makeUpload('image', 10);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/reminder-config
// ─────────────────────────────────────────────────────────────────────────────
async function getReminderConfig(req, res) {
  try {
    let config = await ReminderConfig.findOne({ organizationId: req.admin.organizationId });

    if (!config) {
      // Bootstrap defaults — inherit registration page logo from PageConfig if available
      const pageConfig = await PageConfig.findOne({ organizationId: req.admin.organizationId });
      config = await ReminderConfig.create({
        organizationId: req.admin.organizationId,
        logoUrl:        pageConfig?.logoUrl || null,
      });
    }

    // Include sent-count stats per interval
    const logs = await ReminderLog.aggregate([
      { $match: { organizationId: req.admin.organizationId } },
      { $group: { _id: { days: '$daysBeforeEvent', dateKey: '$eventDateKey' }, count: { $sum: 1 } } },
    ]);

    const obj = config.toObject();
    obj._stats = logs;
    res.json(obj);
  } catch (err) {
    console.error('[ReminderConfig] GET error:', err);
    res.status(500).json({ message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/reminder-config
// ─────────────────────────────────────────────────────────────────────────────
async function updateReminderConfig(req, res) {
  try {
    // Protect image URL fields — they are set only via the dedicated upload endpoint
    const PROTECTED = ['logoUrl', 'headerImageUrl', 'footerImageUrl'];
    const body      = { ...req.body };
    PROTECTED.forEach(f => delete body[f]);

    const config = await ReminderConfig.findOneAndUpdate(
      { organizationId: req.admin.organizationId },
      { $set: body },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(config);
  } catch (err) {
    console.error('[ReminderConfig] PUT error:', err);
    res.status(500).json({ message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/reminder-config/image/:type  (type = logo | header | footer)
// ─────────────────────────────────────────────────────────────────────────────
async function uploadReminderImage(req, res) {
  const TYPE_MAP = { logo: 'logoUrl', header: 'headerImageUrl', footer: 'footerImageUrl' };
  const field    = TYPE_MAP[req.params.type];
  if (!field) return res.status(400).json({ message: 'Invalid image type' });

  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    let url;
    try {
      // Try Cloudinary first
      const result = await uploadToCloudinary(req.file.buffer, { folder: 'reminder' });
      url = result.secure_url;
    } catch (_cloudinaryErr) {
      // Local fallback (dev — no Cloudinary credentials)
      const fs   = require('fs');
      const path = require('path');
      const ext  = req.file.originalname.split('.').pop() || 'png';
      const name = `reminder-${req.params.type}-${Date.now()}.${ext}`;
      const dest = path.join(__dirname, '..', 'uploads', name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, req.file.buffer);
      url = `/uploads/${name}`;
    }

    await ReminderConfig.findOneAndUpdate(
      { organizationId: req.admin.organizationId },
      { $set: { [field]: url } },
      { upsert: true }
    );
    res.json({ [field]: url, url });
  } catch (err) {
    console.error('[ReminderConfig] Image upload error:', err);
    res.status(500).json({ message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/reminder-config/image/:type
// ─────────────────────────────────────────────────────────────────────────────
async function removeReminderImage(req, res) {
  const TYPE_MAP = { logo: 'logoUrl', header: 'headerImageUrl', footer: 'footerImageUrl' };
  const field    = TYPE_MAP[req.params.type];
  if (!field) return res.status(400).json({ message: 'Invalid image type' });

  try {
    await ReminderConfig.findOneAndUpdate(
      { organizationId: req.admin.organizationId },
      { $set: { [field]: null } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/reminder-config/test
// ─────────────────────────────────────────────────────────────────────────────
async function sendTestReminderEmail(req, res) {
  try {
    const config = await ReminderConfig.findOne({ organizationId: req.admin.organizationId });
    if (!config) return res.status(404).json({ message: 'Reminder config not found — save it first.' });
    if (!config.subject) return res.status(400).json({ message: 'Add a subject to the reminder template before sending a test.' });

    const event = await Event.findOne({ organizationId: req.admin.organizationId });

    // Use real event date if available, else pretend the event is 7 days away
    const msUntilEvent = event?.startDate
      ? Math.max(0, new Date(event.startDate) - Date.now())
      : 7 * 86_400_000;
    const countdown = formatCountdown(msUntilEvent);

    const siteUrl            = (process.env.SITE_URL || '').replace(/\/$/, '');
    const countdownImageHtml = siteUrl
      ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
           <tr><td align="center">
             <img src="${siteUrl}/api/countdown-image" alt="${countdown}" width="480"
                  style="display:block;max-width:480px;border-radius:8px;" />
           </td></tr>
         </table>`
      : '';

    // Send to the admin's own address using a dummy registrant object
    const dummyRegistrant = {
      firstName: 'Jane',
      lastName:  'Doe',
      email:     req.admin.email,
    };
    const dummyEvent = event || { name: 'Your Event' };

    await sendReminderEmail(dummyRegistrant, config, dummyEvent, countdown, countdownImageHtml);

    res.json({ success: true });
  } catch (err) {
    console.error('[ReminderConfig] Test email error:', err);
    res.status(500).json({ message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/reminder-config/trigger   (manual trigger — dev/testing)
// ─────────────────────────────────────────────────────────────────────────────
async function triggerReminderNow(req, res) {
  try {
    runReminderCheck().catch(err => console.error('[Reminders] Triggered check error:', err));
    res.json({ message: 'Reminder check triggered in background.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/reminder-config/logs
// Clears sent-log for this org — lets reminders be resent (for testing)
// ─────────────────────────────────────────────────────────────────────────────
async function clearReminderLogs(req, res) {
  try {
    const result = await ReminderLog.deleteMany({ organizationId: req.admin.organizationId });
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getReminderConfig,
  updateReminderConfig,
  uploadReminderImage,
  removeReminderImage,
  handleReminderImageUpload,
  sendTestReminderEmail,
  triggerReminderNow,
  clearReminderLogs,
};
