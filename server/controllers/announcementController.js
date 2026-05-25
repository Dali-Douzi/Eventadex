'use strict';

/**
 * Announcement controller — bulk email blasts to registrants.
 *
 * GET  /api/admin/announcements/preview  → recipient count for current filters
 * POST /api/admin/announcements/send     → send the announcement
 */

const mongoose = require('mongoose');
const {
  EmailTemplate, Registrant, VipRegistrant, Event,
} = require('../models');
const { buildEmailHtml }                       = require('../utils/buildEmailHtml');
const { createTransport, getFrom, readUpload } = require('../services/emailService');

function orgId(req) { return req.user.organizationId; }

// ── Build Mongoose filter from audience + optional sessionId ─────────────────
function buildFilter(organizationId, audience, sessionId) {
  const filter = { organizationId };
  if (sessionId && mongoose.isValidObjectId(sessionId)) {
    filter.sessionId = new mongoose.Types.ObjectId(sessionId);
  }
  if (audience === 'checkedIn')    filter.checkedIn = true;
  if (audience === 'notCheckedIn') filter.checkedIn = { $ne: true };
  return filter;
}

// ── Fetch recipients based on audience ───────────────────────────────────────
async function fetchRecipients(filter, audience, idsOnly = false) {
  const projection = idsOnly ? '_id' : 'firstName lastName email';

  if (audience === 'vip') {
    return VipRegistrant.find(filter).select(projection).lean();
  }
  if (audience === 'standard' || audience === 'checkedIn' || audience === 'notCheckedIn') {
    return Registrant.find(filter).select(projection).lean();
  }

  // 'all' — merge both, deduplicate by email
  const [standard, vip] = await Promise.all([
    Registrant.find(filter).select(projection).lean(),
    VipRegistrant.find(filter).select(projection).lean(),
  ]);

  const seen = new Set();
  return [...standard, ...vip].filter((r) => {
    if (!r.email || seen.has(r.email.toLowerCase())) return false;
    seen.add(r.email.toLowerCase());
    return true;
  });
}

// ── GET /api/admin/announcements/preview ─────────────────────────────────────

async function previewCount(req, res) {
  try {
    const { audience = 'all', sessionId } = req.query;
    const id     = orgId(req);
    const filter = buildFilter(id, audience, sessionId);

    let standard = 0;
    let vip      = 0;

    if (audience === 'vip') {
      vip = await VipRegistrant.countDocuments(filter);
    } else if (audience !== 'all') {
      // standard | checkedIn | notCheckedIn
      standard = await Registrant.countDocuments(filter);
    } else {
      [standard, vip] = await Promise.all([
        Registrant.countDocuments(filter),
        VipRegistrant.countDocuments(filter),
      ]);
    }

    res.json({ total: standard + vip, standard, vip });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ── POST /api/admin/announcements/send ───────────────────────────────────────

async function sendAnnouncement(req, res) {
  try {
    const { subject, body, audience = 'all', sessionId } = req.body;

    if (!subject?.trim()) return res.status(400).json({ message: 'Subject is required' });
    if (!body?.trim())    return res.status(400).json({ message: 'Body is required' });

    const id         = orgId(req);
    const filter     = buildFilter(id, audience, sessionId);
    const recipients = await fetchRecipients(filter, audience);

    if (recipients.length === 0) {
      return res.json({ sent: 0, failed: 0, total: 0 });
    }

    // ── Build base template (use org branding from EmailTemplate) ────────────
    const [emailTemplate, event] = await Promise.all([
      EmailTemplate.findOne({ organizationId: id }),
      Event.findOne({ organizationId: id }).select('name').lean(),
    ]);

    const baseTemplate = emailTemplate
      ? (emailTemplate.toObject ? emailTemplate.toObject() : { ...emailTemplate })
      : {};

    // ── CID image attachments (reuse existing branding images) ───────────────
    const logoBuffer        = readUpload(baseTemplate.logoUrl);
    const headerImageBuffer = readUpload(baseTemplate.headerImageUrl);
    const footerImageBuffer = readUpload(baseTemplate.footerImageUrl);

    const templateForHtml = {
      ...baseTemplate,
      logoUrl:        logoBuffer        ? 'cid:logo'        : (baseTemplate.logoUrl        || null),
      headerImageUrl: headerImageBuffer ? 'cid:headerImage' : (baseTemplate.headerImageUrl || null),
      footerImageUrl: footerImageBuffer ? 'cid:footerImage' : (baseTemplate.footerImageUrl || null),
      buttonLabel:    null,
      // Use customHtml path so no QR block is appended automatically.
      // Convert \n → <br> so plain-text entries render line-breaks.
      customHtml:     body.replace(/\n/g, '<br>'),
    };

    const baseAttachments = [];
    if (logoBuffer)        baseAttachments.push({ filename: 'logo.png',        content: logoBuffer,        contentType: 'image/png', cid: 'logo' });
    if (headerImageBuffer) baseAttachments.push({ filename: 'headerImage.png', content: headerImageBuffer, contentType: 'image/png', cid: 'headerImage' });
    if (footerImageBuffer) baseAttachments.push({ filename: 'footerImage.png', content: footerImageBuffer, contentType: 'image/png', cid: 'footerImage' });

    // ── Create SMTP transport ────────────────────────────────────────────────
    let transporter;
    try {
      transporter = createTransport();
    } catch (transportErr) {
      return res.status(503).json({
        message: 'Email is not configured. Set EMAIL_HOST, EMAIL_USER and EMAIL_PASS in your .env file.',
      });
    }

    const from      = getFrom();
    const eventName = event?.name || '';

    let sent = 0;
    let failed = 0;

    // ── Send in batches of 20 with 50 ms gap to avoid SMTP throttling ────────
    const BATCH = 20;
    for (let i = 0; i < recipients.length; i += BATCH) {
      const batch = recipients.slice(i, i + BATCH);

      const results = await Promise.allSettled(
        batch.map((r) => {
          const vars = {
            firstName: r.firstName || '',
            lastName:  r.lastName  || '',
            eventName,
          };

          const html = buildEmailHtml(templateForHtml, vars);

          // Also substitute variables in the subject line
          const resolvedSubject = subject
            .replace(/\{\{firstName\}\}/g, vars.firstName)
            .replace(/\{\{lastName\}\}/g,  vars.lastName)
            .replace(/\{\{eventName\}\}/g, vars.eventName);

          return transporter.sendMail({
            from,
            to:          r.email,
            subject:     resolvedSubject,
            html,
            attachments: baseAttachments,
          });
        })
      );

      results.forEach((r) => (r.status === 'fulfilled' ? sent++ : failed++));

      // Brief pause between batches (skip for last batch)
      if (i + BATCH < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    res.json({ sent, failed, total: recipients.length });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

module.exports = { previewCount, sendAnnouncement };
