'use strict';

/**
 * Email service — registration confirmation & test emails.
 *
 * Uses Nodemailer with SMTP credentials from .env:
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
 *
 * QR code is sent as a CID inline attachment (cid: 'qrcode') rather than a
 * base64 data-URL embedded in the HTML, which is far more compatible with
 * email clients (Gmail, Outlook, Apple Mail).
 */

const fs         = require('fs');
const path       = require('path');
const nodemailer = require('nodemailer');
const QRCode     = require('qrcode');
const { buildEmailHtml } = require('../utils/buildEmailHtml');

// Returns true for full Cloudinary / external URLs — these are embedded
// directly in the HTML as <img src="https://…"> rather than CID attachments.
function isAbsoluteUrl(p) {
  return !!p && (p.startsWith('http://') || p.startsWith('https://'));
}

// Resolves a relative URL path (e.g. /uploads/email/logo.png) to an absolute
// filesystem path, then reads and returns the file as a Buffer.
// Returns null for absolute URLs (handled separately) or missing files.
function readUpload(urlPath) {
  if (!urlPath || urlPath.startsWith('cid:')) return null;
  if (isAbsoluteUrl(urlPath)) return null; // Cloudinary — not on disk
  const relative = urlPath.replace(/^\//, '');
  const absPath  = path.join(__dirname, '..', relative);
  return fs.existsSync(absPath) ? fs.readFileSync(absPath) : null;
}

// ─── Transport ────────────────────────────────────────────────────────────────

/**
 * Creates a new Nodemailer SMTP transport from env vars.
 * Throws a descriptive error if the required vars are missing so the
 * caller can catch and log without crashing the server.
 */
function createTransport() {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error(
      'Email transport not configured — set EMAIL_HOST, EMAIL_USER and EMAIL_PASS in .env'
    );
  }

  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST,
    port:   parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',   // true → port 465 TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/** Resolved "From" header — uses EMAIL_FROM when set, falls back gracefully. */
function getFrom() {
  return (
    process.env.EMAIL_FROM ||
    `"Eventadex" <${process.env.EMAIL_USER || 'no-reply@eventadex.app'}>`
  );
}

// ─── Variable substitution ────────────────────────────────────────────────────

function sub(str, vars) {
  if (!str) return '';
  return str
    .replace(/\{\{firstName\}\}/g,   vars.firstName   || '')
    .replace(/\{\{lastName\}\}/g,    vars.lastName    || '')
    .replace(/\{\{eventName\}\}/g,   vars.eventName   || '')
    .replace(/\{\{sessionName\}\}/g, vars.sessionName || '')
    .replace(/\{\{sessionDate\}\}/g, vars.sessionDate || '');
}

// ─── QR buffer helper ─────────────────────────────────────────────────────────

/**
 * Converts a base64 data-URL  (data:image/png;base64,…)  or a raw base64
 * string into a Buffer suitable for a nodemailer attachment.
 */
function dataUrlToBuffer(dataUrl) {
  if (!dataUrl) return null;
  const b64 = dataUrl.startsWith('data:')
    ? dataUrl.replace(/^data:image\/\w+;base64,/, '')
    : dataUrl;
  return Buffer.from(b64, 'base64');
}

// ─── sendConfirmationEmail ────────────────────────────────────────────────────

/**
 * Sends a registration confirmation email to an attendee.
 *
 * Designed to be called fire-and-forget:
 *   sendConfirmationEmail(opts).catch(err => console.error(err.message));
 *
 * @param {object} opts
 * @param {object}  opts.registrant    – plain registrant object  (firstName, lastName, email …)
 * @param {object}  opts.event         – { name }
 * @param {object}  opts.session       – { name, date }
 * @param {object}  opts.organization  – { name }  (reserved for future use)
 * @param {object}  opts.emailTemplate – EmailTemplate document or plain object
 * @param {string}  opts.qrCodeDataUrl – data:image/png;base64,… string from QRCode.toDataURL()
 */
async function sendConfirmationEmail({
  registrant,
  event,
  session,
  organization,
  emailTemplate,
  qrCodeDataUrl,
  logoUrl,
}) {
  // Silently skip when no template or no subject has been configured yet
  if (!emailTemplate || !emailTemplate.subject) return;

  const sessionDate = session?.date
    ? new Date(session.date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : '';

  const vars = {
    firstName:   registrant.firstName  || '',
    lastName:    registrant.lastName   || '',
    eventName:   event?.name           || '',
    sessionName: session?.name         || '',
    sessionDate,
  };

  // ── Inline image attachments (logo, header image, footer image) ──────────
  const tmplPlain = emailTemplate.toObject ? emailTemplate.toObject() : { ...emailTemplate };

  const effectiveLogoUrl = logoUrl || tmplPlain.logoUrl;
  const logoBuffer        = readUpload(effectiveLogoUrl);
  const headerImageBuffer = readUpload(tmplPlain.headerImageUrl);
  const footerImageBuffer = readUpload(tmplPlain.footerImageUrl);

  // For Cloudinary URLs use the absolute URL directly in HTML (no CID needed).
  // For local uploads attach as CID so they survive strict email clients.
  const templateForHtml = {
    ...tmplPlain,
    logoUrl:        logoBuffer        ? 'cid:logo'        : (effectiveLogoUrl         || null),
    headerImageUrl: headerImageBuffer ? 'cid:headerImage' : (tmplPlain.headerImageUrl || null),
    footerImageUrl: footerImageBuffer ? 'cid:footerImage' : (tmplPlain.footerImageUrl || null),
  };

  const html    = buildEmailHtml(templateForHtml, vars);
  const subject = sub(emailTemplate.subject, vars);

  // ── Build attachments ─────────────────────────────────────────────────────
  const attachments = [];
  if (logoBuffer)        attachments.push({ filename: 'logo.png',        content: logoBuffer,        contentType: 'image/png', cid: 'logo' });
  if (headerImageBuffer) attachments.push({ filename: 'headerImage.png', content: headerImageBuffer, contentType: 'image/png', cid: 'headerImage' });
  if (footerImageBuffer) attachments.push({ filename: 'footerImage.png', content: footerImageBuffer, contentType: 'image/png', cid: 'footerImage' });

  const qrBuffer = dataUrlToBuffer(qrCodeDataUrl);
  if (qrBuffer) attachments.push({ filename: 'qrcode.png', content: qrBuffer, contentType: 'image/png', cid: 'qrcode' });

  const transporter = createTransport();
  await transporter.sendMail({ from: getFrom(), to: registrant.email, subject, html, attachments });
}


// ─── sendTestEmail ────────────────────────────────────────────────────────────

/**
 * Sends a preview of the configured email template to a given address using
 * dummy attendee data, so the admin can see exactly what registrants receive.
 *
 * @param {object} opts
 * @param {object}  opts.emailTemplate  – EmailTemplate document or plain object
 * @param {string}  opts.toEmail        – recipient address (usually org.email)
 * @param {string}  [opts.eventName]    – fills {{eventName}} in the template
 */
async function sendTestEmail({ emailTemplate, toEmail, eventName, logoUrl }) {
  if (!emailTemplate || !emailTemplate.subject) {
    throw new Error('Email template is not configured or has no subject. Save your template first.');
  }

  const vars = {
    firstName:   'Jane',
    lastName:    'Doe',
    eventName:   eventName || 'Sample Event',
    sessionName: 'Morning Workshop',
    sessionDate: new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }),
  };

  // ── Inline image attachments ──────────────────────────────────────────────
  const tmplPlain = emailTemplate.toObject ? emailTemplate.toObject() : { ...emailTemplate };

  const effectiveLogoUrl  = logoUrl || tmplPlain.logoUrl;
  const logoBuffer        = readUpload(effectiveLogoUrl);
  const headerImageBuffer = readUpload(tmplPlain.headerImageUrl);
  const footerImageBuffer = readUpload(tmplPlain.footerImageUrl);

  const templateForHtml = {
    ...tmplPlain,
    logoUrl:        logoBuffer        ? 'cid:logo'        : (effectiveLogoUrl         || null),
    headerImageUrl: headerImageBuffer ? 'cid:headerImage' : (tmplPlain.headerImageUrl || null),
    footerImageUrl: footerImageBuffer ? 'cid:footerImage' : (tmplPlain.footerImageUrl || null),
  };

  const html    = buildEmailHtml(templateForHtml, vars);
  const subject = `[TEST] ${sub(emailTemplate.subject, vars)}`;

  // ── Build attachments ─────────────────────────────────────────────────────
  const attachments = [];
  if (logoBuffer)        attachments.push({ filename: 'logo.png',        content: logoBuffer,        contentType: 'image/png', cid: 'logo' });
  if (headerImageBuffer) attachments.push({ filename: 'headerImage.png', content: headerImageBuffer, contentType: 'image/png', cid: 'headerImage' });
  if (footerImageBuffer) attachments.push({ filename: 'footerImage.png', content: footerImageBuffer, contentType: 'image/png', cid: 'footerImage' });

  // Generate a real dummy QR code so the test email shows what attendees see
  const qrDataUrl = await QRCode.toDataURL('EVENTADEX-TEST-PREVIEW', { width: 200, margin: 1 });
  attachments.push({ filename: 'qrcode.png', content: dataUrlToBuffer(qrDataUrl), contentType: 'image/png', cid: 'qrcode' });

  const transporter = createTransport();
  await transporter.sendMail({ from: getFrom(), to: toEmail, subject, html, attachments });
}

module.exports = {
  sendConfirmationEmail,
  sendTestEmail,
  // Shared transport helpers — exported for reminderService
  isAbsoluteUrl,
  readUpload,
  createTransport,
  getFrom,
  dataUrlToBuffer,
};
