const mongoose = require('mongoose');
const crypto   = require('crypto');
const path     = require('path');
const ExcelJS  = require('exceljs');
const PDFDocument = require('pdfkit');
const {
  Organization, Event, PageConfig, EmailTemplate, Registrant, BadgeConfig,
  VipRegistrant, VipPageConfig, VipEmailTemplate,
  WaitlistRegistrant, VipWaitlistRegistrant,
  Title, Country, HearAbout,
} = require('../models');
const { sendTestEmail: sendTestEmailService } = require('../services/emailService');
const { uploadToCloudinary } = require('../config/cloudinary');

// ─── Regex-safe search helper ────────────────────────────────────────────────
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Standard field names — anything outside this set is a custom field
const STANDARD_FIELD_NAMES = new Set([
  'firstName', 'lastName', 'email', 'phone', 'landline', 'mobile',
  'gender', 'country', 'title', 'hearAbout',
]);

// ─── Lookup type → model ─────────────────────────────────────────────────────

const LOOKUP_MODELS = { Title, Country, HearAbout };
const LOOKUP_TYPES  = Object.keys(LOOKUP_MODELS);

function getLookupModel(type) {
  const key = LOOKUP_TYPES.find((k) => k.toLowerCase() === type.toLowerCase());
  return key ? LOOKUP_MODELS[key] : null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function orgId(req) {
  return req.user.organizationId;
}

// ─── 1. Event management ─────────────────────────────────────────────────────

async function getEvent(req, res) {
  try {
    const event = await Event.findOne({ organizationId: orgId(req) });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

const EVENT_ALLOWED_FIELDS = [
  'name', 'description', 'eventType', 'startDate', 'endDate',
  'registrationOpenDate', 'status', 'paymentEnabled',
  'ticketPrice', 'currency',
];

async function updateEvent(req, res) {
  try {
    const updates = {};
    EVENT_ALLOWED_FIELDS.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    const event = await Event.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function addSession(req, res) {
  try {
    const { name, date, capacity, waitlistCapacity } = req.body;
    if (!name || !date || capacity === undefined) {
      return res.status(400).json({ message: 'name, date, and capacity are required' });
    }

    const event = await Event.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $push: { sessions: { name, date, capacity, waitlistCapacity: waitlistCapacity ?? 0 } } },
      { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

const SESSION_ALLOWED = ['name', 'date', 'capacity', 'waitlistCapacity'];

async function updateSession(req, res) {
  try {
    const { sessionId } = req.params;
    if (!mongoose.isValidObjectId(sessionId)) {
      return res.status(400).json({ message: 'Invalid session ID' });
    }

    const updates = {};
    SESSION_ALLOWED.forEach((key) => {
      if (req.body[key] !== undefined) updates[`sessions.$[s].${key}`] = req.body[key];
    });
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const event = await Event.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: updates },
      { arrayFilters: [{ 's._id': new mongoose.Types.ObjectId(sessionId) }], new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ message: 'Event or session not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function deleteSession(req, res) {
  try {
    const { sessionId } = req.params;
    if (!mongoose.isValidObjectId(sessionId)) {
      return res.status(400).json({ message: 'Invalid session ID' });
    }

    const event = await Event.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $pull: { sessions: { _id: new mongoose.Types.ObjectId(sessionId) } } },
      { new: true }
    );
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ─── 2. Page config ───────────────────────────────────────────────────────────

async function getPageConfig(req, res) {
  try {
    const config = await PageConfig.findOne({ organizationId: orgId(req) });
    if (!config) return res.status(404).json({ message: 'Page config not found' });
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function updatePageConfig(req, res) {
  try {
    const { organizationId: _oid, ...fields } = req.body;

    const config = await PageConfig.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: fields },
      { new: true, runValidators: true, upsert: true }
    );
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function uploadLogo(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `registrations/${orgId(req)}/logos`,
    });
    const logoUrl = result.secure_url;

    await PageConfig.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: { logoUrl } },
      { upsert: true }
    );

    res.json({ logoUrl });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function uploadPageBanner(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const { slot } = req.params; // 'header', 'footer', or 'bg'
    const BANNER_FIELD = { header: 'headerImageUrl', footer: 'footerImageUrl', bg: 'bodyBgImageUrl' };
    if (!BANNER_FIELD[slot]) {
      return res.status(400).json({ message: 'Invalid slot' });
    }
    const field = BANNER_FIELD[slot];
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `registrations/${orgId(req)}/banners`,
    });
    const url = result.secure_url;
    await PageConfig.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: { [field]: url } },
      { upsert: true }
    );
    res.json({ [field]: url });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function uploadVipPageBanner(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const { slot } = req.params;
    const BANNER_FIELD = { header: 'headerImageUrl', footer: 'footerImageUrl', bg: 'bodyBgImageUrl' };
    if (!BANNER_FIELD[slot]) {
      return res.status(400).json({ message: 'Invalid slot' });
    }
    const field = BANNER_FIELD[slot];
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `registrations/${orgId(req)}/vip-banners`,
    });
    const url = result.secure_url;
    await VipPageConfig.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: { [field]: url } },
      { upsert: true }
    );
    res.json({ [field]: url });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ─── 3. Email template ────────────────────────────────────────────────────────

async function getEmailTemplate(req, res) {
  try {
    const [template, pageConfig] = await Promise.all([
      EmailTemplate.findOne({ organizationId: orgId(req) }),
      PageConfig.findOne({ organizationId: orgId(req) }).select('logoUrl'),
    ]);
    if (!template) return res.status(404).json({ message: 'Email template not found' });
    const obj = template.toObject();
    obj._pageLogoUrl = pageConfig?.logoUrl || null;
    res.json(obj);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function updateEmailTemplate(req, res) {
  try {
    // Strip organizationId — never allow caller to change ownership
    const { organizationId: _oid, ...fields } = req.body;

    const template = await EmailTemplate.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: fields },
      { new: true, runValidators: true, upsert: true }
    );
    res.json(template);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function uploadEmailImage(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const FIELD_MAP = { logo: 'logoUrl', header: 'headerImageUrl', footer: 'footerImageUrl' };
    const field = FIELD_MAP[req.params.type];
    if (!field) return res.status(400).json({ message: 'Invalid image type. Use logo, header, or footer.' });

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `registrations/${orgId(req)}/email`,
    });
    const url = result.secure_url;

    await EmailTemplate.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: { [field]: url } },
      { upsert: true }
    );

    res.json({ url });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function sendTestEmail(req, res) {
  try {
    const id = orgId(req);
    const [org, template, event, pageConfig] = await Promise.all([
      Organization.findById(id).select('email name'),
      EmailTemplate.findOne({ organizationId: id }),
      Event.findOne({ organizationId: id }).select('name'),
      PageConfig.findOne({ organizationId: id }).select('logoUrl'),
    ]);

    if (!template) {
      return res.status(404).json({ message: 'Email template not found. Save your template first.' });
    }
    if (!org?.email) {
      return res.status(400).json({ message: 'Organisation email address is not set.' });
    }

    await sendTestEmailService({
      emailTemplate: template,
      toEmail:       org.email,
      eventName:     event?.name || '',
      logoUrl:       pageConfig?.logoUrl || null,  // relative path e.g. /uploads/logos/file.png
    });

    res.json({ message: `Test email sent to ${org.email}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ─── 3b. VIP Email Template ───────────────────────────────────────────────────

async function getVipEmailTemplate(req, res) {
  try {
    const [template, vipPageConfig] = await Promise.all([
      VipEmailTemplate.findOne({ organizationId: orgId(req) }),
      VipPageConfig.findOne({ organizationId: orgId(req) }).select('logoUrl'),
    ]);
    if (!template) return res.status(404).json({ message: 'VIP email template not found' });
    const obj = template.toObject();
    obj._pageLogoUrl = vipPageConfig?.logoUrl || null;
    res.json(obj);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function updateVipEmailTemplate(req, res) {
  try {
    const { organizationId: _oid, ...fields } = req.body;
    const template = await VipEmailTemplate.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: fields },
      { new: true, runValidators: true, upsert: true }
    );
    res.json(template);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function uploadVipEmailImage(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const FIELD_MAP = { logo: 'logoUrl', header: 'headerImageUrl', footer: 'footerImageUrl' };
    const field = FIELD_MAP[req.params.type];
    if (!field) return res.status(400).json({ message: 'Invalid image type. Use logo, header, or footer.' });
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `registrations/${orgId(req)}/vip-email`,
    });
    const url = result.secure_url;
    await VipEmailTemplate.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: { [field]: url } },
      { upsert: true }
    );
    res.json({ url });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function sendTestVipEmail(req, res) {
  try {
    const id = orgId(req);
    const [org, template, event, vipPageConfig] = await Promise.all([
      Organization.findById(id).select('email name'),
      VipEmailTemplate.findOne({ organizationId: id }),
      Event.findOne({ organizationId: id }).select('name'),
      VipPageConfig.findOne({ organizationId: id }).select('logoUrl'),
    ]);
    if (!template) {
      return res.status(404).json({ message: 'VIP email template not found. Save your template first.' });
    }
    if (!org?.email) {
      return res.status(400).json({ message: 'Organisation email address is not set.' });
    }
    await sendTestEmailService({
      emailTemplate: template,
      toEmail:       org.email,
      eventName:     event?.name || '',
      logoUrl:       vipPageConfig?.logoUrl || null,
    });
    res.json({ message: `Test VIP email sent to ${org.email}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ─── 4. Registrants ───────────────────────────────────────────────────────────

async function listRegistrants(req, res) {
  try {
    const id      = orgId(req);
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip    = (page - 1) * limit;
    const { search, sessionId } = req.query;

    const filter = { organizationId: id };
    if (sessionId && mongoose.isValidObjectId(sessionId)) {
      filter.sessionId = new mongoose.Types.ObjectId(sessionId);
    }
    if (search) {
      const re = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [
        { firstName: re }, { lastName: re }, { email: re },
      ];
    }

    const [registrants, total] = await Promise.all([
      Registrant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Registrant.countDocuments(filter),
    ]);

    res.json({ data: registrants, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

function buildCSV(registrants, pageConfig) {
  // Collect custom field definitions from the page config
  const customFieldDefs = (pageConfig?.formFields || []).filter(
    (f) => !STANDARD_FIELD_NAMES.has(f.fieldName)
  );

  const COLS = [
    { label: 'First Name',        key: 'firstName' },
    { label: 'Last Name',         key: 'lastName' },
    { label: 'Email',             key: 'email' },
    { label: 'Gender',            key: 'gender' },
    { label: 'Phone',             key: 'phone' },
    { label: 'Landline',          key: 'landline' },
    { label: 'Mobile',            key: 'mobile' },
    { label: 'Country',           key: 'country' },
    { label: 'Title',             key: 'title' },
    { label: 'Hear About',        key: 'hearAbout' },
    { label: 'Payment Status',    key: 'paymentStatus' },
    { label: 'Checked In',        key: (r) => (r.checkedIn ? 'Yes' : 'No') },
    { label: 'Checked In At',     key: (r) => (r.checkedInAt  ? new Date(r.checkedInAt).toISOString()  : '') },
    { label: 'Checked Out',       key: (r) => (r.checkedOut ? 'Yes' : 'No') },
    { label: 'Checked Out At',    key: (r) => (r.checkedOutAt ? new Date(r.checkedOutAt).toISOString() : '') },
    { label: 'QR Code',           key: 'qrCode' },
    { label: 'Registered At',     key: (r) => new Date(r.createdAt).toISOString() },
    // Dynamic custom field columns
    ...customFieldDefs.map((f) => ({
      label: f.label,
      key:   (r) => {
        const cf = r.customFields;
        if (!cf) return '';
        return (typeof cf.get === 'function' ? cf.get(f.fieldName) : cf[f.fieldName]) || '';
      },
    })),
  ];

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const header = COLS.map((c) => esc(c.label)).join(',');
  const rows   = registrants.map((r) =>
    COLS.map((c) => esc(typeof c.key === 'function' ? c.key(r) : r[c.key])).join(',')
  );
  return [header, ...rows].join('\n');
}

// ─── Build XLSX buffer ────────────────────────────────────────────────────────
async function buildExcel(registrants, pageConfig, sheetName = 'Registrants') {
  const customFieldDefs = (pageConfig?.formFields || []).filter(
    (f) => !STANDARD_FIELD_NAMES.has(f.fieldName)
  );

  const COLS = [
    { label: 'First Name',        key: 'firstName' },
    { label: 'Last Name',         key: 'lastName' },
    { label: 'Email',             key: 'email' },
    { label: 'Gender',            key: 'gender' },
    { label: 'Phone',             key: 'phone' },
    { label: 'Landline',          key: 'landline' },
    { label: 'Mobile',            key: 'mobile' },
    { label: 'Country',           key: 'country' },
    { label: 'Title',             key: 'title' },
    { label: 'Hear About',        key: 'hearAbout' },
    { label: 'Payment Status',    key: 'paymentStatus' },
    { label: 'Checked In',        key: (r) => (r.checkedIn  ? 'Yes' : 'No') },
    { label: 'Checked In At',     key: (r) => (r.checkedInAt  ? new Date(r.checkedInAt).toISOString()  : '') },
    { label: 'Checked Out',       key: (r) => (r.checkedOut ? 'Yes' : 'No') },
    { label: 'Checked Out At',    key: (r) => (r.checkedOutAt ? new Date(r.checkedOutAt).toISOString() : '') },
    { label: 'QR Code',           key: 'qrCode' },
    { label: 'Registered At',     key: (r) => new Date(r.createdAt).toISOString() },
    ...customFieldDefs.map((f) => ({
      label: f.label,
      key: (r) => {
        const cf = r.customFields;
        if (!cf) return '';
        return (typeof cf.get === 'function' ? cf.get(f.fieldName) : cf[f.fieldName]) || '';
      },
    })),
  ];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  // Column definitions (width + header label)
  ws.columns = COLS.map((c) => ({
    header: c.label,
    width:  Math.max(c.label.length + 2, 14),
  }));

  // Bold header row
  ws.getRow(1).font = { bold: true };

  // Data rows
  registrants.forEach((r) => {
    ws.addRow(COLS.map((c) => {
      const v = typeof c.key === 'function' ? c.key(r) : (r[c.key] ?? '');
      return v;
    }));
  });

  return wb.xlsx.writeBuffer();
}

// ─── Build PDF buffer (returns Promise) ───────────────────────────────────────
function buildPDF(registrants, pageConfig, title = 'Registrants Report') {
  return new Promise((resolve, reject) => {
    const customFieldDefs = (pageConfig?.formFields || []).filter(
      (f) => !STANDARD_FIELD_NAMES.has(f.fieldName)
    );

    const COLS = [
      { label: 'First Name',  key: 'firstName',  w: 70 },
      { label: 'Last Name',   key: 'lastName',   w: 70 },
      { label: 'Email',       key: 'email',      w: 130 },
      { label: 'Country',     key: 'country',    w: 70 },
      { label: 'Checked In',  key: (r) => (r.checkedIn  ? 'Yes' : 'No'), w: 60 },
      { label: 'Checked Out', key: (r) => (r.checkedOut ? 'Yes' : 'No'), w: 60 },
      { label: 'Payment',     key: 'paymentStatus', w: 55 },
      { label: 'Registered',  key: (r) => new Date(r.createdAt).toLocaleDateString('en-GB'), w: 75 },
      ...customFieldDefs.slice(0, 4).map((f) => ({
        label: f.label,
        key: (r) => {
          const cf = r.customFields;
          if (!cf) return '';
          return (typeof cf.get === 'function' ? cf.get(f.fieldName) : cf[f.fieldName]) || '';
        },
        w: 80,
      })),
    ];

    const doc = new PDFDocument({ margin: 28, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width  - 56; // minus both margins
    const totalW = COLS.reduce((s, c) => s + c.w, 0);
    const scale  = pageW / totalW;
    const colWs  = COLS.map((c) => c.w * scale);

    // Title
    doc.fontSize(14).fillColor('#1e293b').text(title, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#64748b').text(
      `Generated ${new Date().toLocaleString()} · ${registrants.length} record${registrants.length !== 1 ? 's' : ''}`,
      { align: 'center' }
    );
    doc.moveDown(0.6);

    // Table header
    const ROW_H    = 18;
    const FONT_SM  = 7.5;
    const PAD      = 4;
    let x = doc.page.margins.left;
    let y = doc.y;

    // Header background
    doc.rect(x, y, pageW, ROW_H).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(FONT_SM);
    let cx = x;
    COLS.forEach((col, i) => {
      doc.text(col.label, cx + PAD, y + 5, { width: colWs[i] - PAD * 2, lineBreak: false, ellipsis: true });
      cx += colWs[i];
    });
    y += ROW_H;

    // Data rows
    doc.fillColor('#1e293b');
    registrants.forEach((r, ri) => {
      if (y + ROW_H > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      // Alternating row bg
      if (ri % 2 === 0) {
        doc.rect(x, y, pageW, ROW_H).fill('#f8fafc');
      }

      doc.fillColor('#1e293b').fontSize(FONT_SM);
      cx = x;
      COLS.forEach((col, i) => {
        const val = typeof col.key === 'function' ? col.key(r) : (r[col.key] ?? '');
        doc.text(String(val), cx + PAD, y + 5, { width: colWs[i] - PAD * 2, lineBreak: false, ellipsis: true });
        cx += colWs[i];
      });

      // Bottom border
      doc.moveTo(x, y + ROW_H).lineTo(x + pageW, y + ROW_H).strokeColor('#e2e8f0').lineWidth(0.4).stroke();
      y += ROW_H;
    });

    doc.end();
  });
}

async function exportRegistrants(req, res) {
  try {
    const filter = { organizationId: orgId(req) };
    const { sessionId, format = 'csv' } = req.query;
    if (sessionId && mongoose.isValidObjectId(sessionId)) {
      filter.sessionId = new mongoose.Types.ObjectId(sessionId);
    }

    const [registrants, pageConfig] = await Promise.all([
      Registrant.find(filter).sort({ createdAt: -1 }).limit(10000),
      PageConfig.findOne({ organizationId: orgId(req) }),
    ]);

    const ts = Date.now();

    if (format === 'xlsx') {
      const buf = await buildExcel(registrants, pageConfig, 'Registrants');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="registrants-${ts}.xlsx"`);
      return res.send(buf);
    }

    if (format === 'pdf') {
      const buf = await buildPDF(registrants, pageConfig, 'Registrants Report');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="registrants-${ts}.pdf"`);
      return res.send(buf);
    }

    // Default: CSV
    const csv = buildCSV(registrants, pageConfig);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="registrants-${ts}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function searchRegistrant(req, res) {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'q query param is required' });

    const trimmed = q.trim();
    const emailRe = new RegExp(escapeRegex(trimmed), 'i');

    // QR scanners send the exact UUID value; email is typed so allow partial match
    const registrant = await Registrant.findOne({
      organizationId: orgId(req),
      $or: [
        { qrCode: trimmed },    // exact match for QR scanner input
        { email: emailRe },     // partial case-insensitive for typed email
      ],
    }).lean();

    if (!registrant) return res.status(404).json({ message: 'Registrant not found' });

    // Enrich response with event / session / logo / badge config for badge printing
    const [event, pageConfig, badgeConfig] = await Promise.all([
      Event.findOne({ organizationId: orgId(req) }).select('name sessions').lean(),
      PageConfig.findOne({ organizationId: orgId(req) }).select('logoUrl').lean(),
      BadgeConfig.findOne({ organizationId: orgId(req) }).lean(),
    ]);

    const session = (event?.sessions || []).find(
      (s) => s._id?.toString() === registrant.sessionId?.toString()
    );

    return res.json({
      ...registrant,
      eventName:   event?.name         || '',
      sessionName: session?.name       || '',
      sessionDate: session?.date       || null,
      logoUrl:     pageConfig?.logoUrl || null,
      badgeConfig: badgeConfig         || null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function getRegistrant(req, res) {
  try {
    const registrant = await Registrant.findOne({
      _id: req.params.id,
      organizationId: orgId(req),
    });
    if (!registrant) return res.status(404).json({ message: 'Registrant not found' });
    res.json(registrant);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function checkIn(req, res) {
  try {
    const registrant = await Registrant.findOneAndUpdate(
      { _id: req.params.id, organizationId: orgId(req) },
      { $set: { checkedIn: true, checkedInAt: new Date() } },
      { new: true }
    );
    if (!registrant) return res.status(404).json({ message: 'Registrant not found' });
    res.json(registrant);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function checkOut(req, res) {
  try {
    const registrant = await Registrant.findOneAndUpdate(
      { _id: req.params.id, organizationId: orgId(req) },
      { $set: { checkedOut: true, checkedOutAt: new Date() } },
      { new: true }
    );
    if (!registrant) return res.status(404).json({ message: 'Registrant not found' });
    res.json(registrant);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ─── 5. Dashboard stats ───────────────────────────────────────────────────────

async function getDashboardStats(req, res) {
  try {
    const id    = orgId(req);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [event, totalRegistrants, checkedInToday, recentRegs, sessionCounts] = await Promise.all([
      Event.findOne({ organizationId: id }),
      Registrant.countDocuments({ organizationId: id }),
      Registrant.countDocuments({
        organizationId: id,
        checkedIn:  true,
        checkedInAt: { $gte: today, $lt: tomorrow },
      }),
      Registrant.find({ organizationId: id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('firstName lastName email createdAt sessionId'),
      Registrant.aggregate([
        { $match: { organizationId: new mongoose.Types.ObjectId(id) } },
        { $group: { _id: '$sessionId', count: { $sum: 1 } } },
      ]),
    ]);

    // Build session → count map
    const countMap = {};
    sessionCounts.forEach(({ _id, count }) => {
      if (_id) countMap[_id.toString()] = count;
    });

    // Build session → name map
    const sessionMap = {};
    (event?.sessions || []).forEach((s) => {
      sessionMap[s._id.toString()] = s.name;
    });

    const sessions = (event?.sessions || []).map((s) => ({
      _id:              s._id,
      name:             s.name,
      date:             s.date,
      capacity:         s.capacity,
      waitlistCapacity: s.waitlistCapacity,
      registered:       countMap[s._id.toString()] || s.registered || 0,
    }));

    const recentRegistrants = recentRegs.map((r) => ({
      _id:         r._id,
      firstName:   r.firstName,
      lastName:    r.lastName,
      email:       r.email,
      createdAt:   r.createdAt,
      sessionName: r.sessionId ? (sessionMap[r.sessionId.toString()] || '') : '',
    }));

    res.json({
      totalRegistrants,
      checkedInToday,
      eventStatus:    event?.status || 'draft',
      sessionsCount:  sessions.length,
      sessions,
      recentRegistrants,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ─── 5b. Payment settings ────────────────────────────────────────────────────

async function updatePaymentSettings(req, res) {
  try {
    const {
      paymentEnabled, ticketPrice, currency,
      vipPaymentEnabled, vipTicketPrice, vipCurrency,
    } = req.body;

    const updates = {};

    // ── Standard registration payment ────────────────────────
    if (paymentEnabled !== undefined) {
      updates.paymentEnabled = Boolean(paymentEnabled);
    }
    if (ticketPrice !== undefined) {
      const price = Number(ticketPrice);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ message: 'ticketPrice must be a non-negative number' });
      }
      updates.ticketPrice = price;
    }
    if (currency !== undefined) {
      const cur = String(currency).toUpperCase().trim();
      if (!/^[A-Z]{3}$/.test(cur)) {
        return res.status(400).json({ message: 'currency must be a 3-letter ISO code (e.g. USD)' });
      }
      updates.currency = cur;
    }

    // ── VIP registration payment ─────────────────────────────
    if (vipPaymentEnabled !== undefined) {
      updates.vipPaymentEnabled = Boolean(vipPaymentEnabled);
    }
    if (vipTicketPrice !== undefined) {
      const price = Number(vipTicketPrice);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ message: 'vipTicketPrice must be a non-negative number' });
      }
      updates.vipTicketPrice = price;
    }
    if (vipCurrency !== undefined) {
      const cur = String(vipCurrency).toUpperCase().trim();
      if (!/^[A-Z]{3}$/.test(cur)) {
        return res.status(400).json({ message: 'vipCurrency must be a 3-letter ISO code (e.g. USD)' });
      }
      updates.vipCurrency = cur;
    }

    const event = await Event.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ─── 6. Badge config ─────────────────────────────────────────────────────────

// Default fields applied when a new BadgeConfig is auto-created
const DEFAULT_BADGE_FIELDS = [
  { fieldName: 'fullName',    label: 'Full Name',      visible: true,  fontSize: 15, fontWeight: 'bold',   textColor: '#0f172a', align: 'center', order: 0 },
  { fieldName: 'firstName',   label: 'First Name',     visible: false, fontSize: 13, fontWeight: 'normal', textColor: '#0f172a', align: 'center', order: 1 },
  { fieldName: 'lastName',    label: 'Last Name',      visible: false, fontSize: 13, fontWeight: 'normal', textColor: '#0f172a', align: 'center', order: 2 },
  { fieldName: 'title',       label: 'Title (Mr/Mrs)', visible: true,  fontSize: 9,  fontWeight: 'normal', textColor: '#475569', align: 'center', order: 3 },
  { fieldName: 'sessionName', label: 'Session',        visible: true,  fontSize: 8,  fontWeight: 'normal', textColor: '#64748b', align: 'center', order: 4 },
  { fieldName: 'country',     label: 'Country',        visible: false, fontSize: 8,  fontWeight: 'normal', textColor: '#64748b', align: 'center', order: 6 },
];

async function getBadgeConfig(req, res) {
  try {
    let config = await BadgeConfig.findOne({ organizationId: orgId(req) });
    if (!config) {
      // Auto-create with defaults
      config = await BadgeConfig.create({
        organizationId: orgId(req),
        fields: DEFAULT_BADGE_FIELDS,
      });
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function updateBadgeConfig(req, res) {
  try {
    // Never allow overwriting organizationId or backgroundImageUrl via this endpoint
    const { organizationId: _oid, backgroundImageUrl: _bg, ...fields } = req.body;

    const config = await BadgeConfig.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: fields },
      { new: true, runValidators: true, upsert: true }
    );
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function uploadBadgeBackground(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `registrations/${orgId(req)}/badges`,
    });
    const backgroundImageUrl = result.secure_url;

    await BadgeConfig.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: { backgroundImageUrl } },
      { upsert: true }
    );

    res.json({ backgroundImageUrl });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ─── 7. Lookups (read-only) ───────────────────────────────────────────────────

async function getLookups(req, res) {
  try {
    const Model = getLookupModel(req.params.type);
    if (!Model) {
      return res.status(400).json({
        message: `Invalid lookup type. Allowed: ${LOOKUP_TYPES.join(', ')}`,
      });
    }

    const id = orgId(req);
    const items = await Model.find({
      $or: [{ organizationId: null }, { organizationId: id }],
      status: 'available',
    }).sort({ name: 1 });

    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ─── 8. VIP page config ───────────────────────────────────────────────────────

async function getVipPageConfig(req, res) {
  try {
    let config = await VipPageConfig.findOne({ organizationId: orgId(req) });
    if (!config) {
      config = await VipPageConfig.create({ organizationId: orgId(req) });
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function updateVipPageConfig(req, res) {
  try {
    const { organizationId: _oid, ...fields } = req.body;

    const config = await VipPageConfig.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: fields },
      { new: true, runValidators: true, upsert: true }
    );
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function uploadVipLogo(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `registrations/${orgId(req)}/vip-logos`,
    });
    const logoUrl = result.secure_url;

    await VipPageConfig.findOneAndUpdate(
      { organizationId: orgId(req) },
      { $set: { logoUrl } },
      { upsert: true }
    );

    res.json({ logoUrl });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ─── 9. VIP registrants ───────────────────────────────────────────────────────

async function listVipRegistrants(req, res) {
  try {
    const id    = orgId(req);
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;
    const { search, sessionId } = req.query;

    const filter = { organizationId: id };
    if (sessionId && mongoose.isValidObjectId(sessionId)) {
      filter.sessionId = new mongoose.Types.ObjectId(sessionId);
    }
    if (search) {
      const re = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ firstName: re }, { lastName: re }, { email: re }];
    }

    const [registrants, total] = await Promise.all([
      VipRegistrant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      VipRegistrant.countDocuments(filter),
    ]);

    res.json({ data: registrants, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function exportVipRegistrants(req, res) {
  try {
    const filter = { organizationId: orgId(req) };
    const { sessionId, format = 'csv' } = req.query;
    if (sessionId && mongoose.isValidObjectId(sessionId)) {
      filter.sessionId = new mongoose.Types.ObjectId(sessionId);
    }

    const [registrants, vipPageConfig] = await Promise.all([
      VipRegistrant.find(filter).sort({ createdAt: -1 }).limit(10000),
      VipPageConfig.findOne({ organizationId: orgId(req) }),
    ]);

    const ts = Date.now();

    if (format === 'xlsx') {
      const buf = await buildExcel(registrants, vipPageConfig, 'VIP Registrants');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="vip-registrants-${ts}.xlsx"`);
      return res.send(buf);
    }

    if (format === 'pdf') {
      const buf = await buildPDF(registrants, vipPageConfig, 'VIP Registrants Report');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="vip-registrants-${ts}.pdf"`);
      return res.send(buf);
    }

    // Default: CSV
    const csv = buildCSV(registrants, vipPageConfig);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="vip-registrants-${ts}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function searchVipRegistrant(req, res) {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'q query param is required' });

    const trimmed = q.trim();
    const emailRe = new RegExp(escapeRegex(trimmed), 'i');

    const registrant = await VipRegistrant.findOne({
      organizationId: orgId(req),
      $or: [
        { qrCode: trimmed },
        { email: emailRe },
      ],
    }).lean();

    if (!registrant) return res.status(404).json({ message: 'VIP registrant not found' });

    const [event, vipPageConfig, badgeConfig] = await Promise.all([
      Event.findOne({ organizationId: orgId(req) }).select('name sessions').lean(),
      VipPageConfig.findOne({ organizationId: orgId(req) }).select('logoUrl').lean(),
      BadgeConfig.findOne({ organizationId: orgId(req) }).lean(),
    ]);

    const session = (event?.sessions || []).find(
      (s) => s._id?.toString() === registrant.sessionId?.toString()
    );

    return res.json({
      ...registrant,
      eventName:   event?.name              || '',
      sessionName: session?.name            || '',
      sessionDate: session?.date            || null,
      logoUrl:     vipPageConfig?.logoUrl   || null,
      badgeConfig: badgeConfig              || null,
      badgeType:   'vip',
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function checkInVip(req, res) {
  try {
    const registrant = await VipRegistrant.findOneAndUpdate(
      { _id: req.params.id, organizationId: orgId(req) },
      { $set: { checkedIn: true, checkedInAt: new Date() } },
      { new: true }
    );
    if (!registrant) return res.status(404).json({ message: 'VIP registrant not found' });
    res.json(registrant);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function checkOutVip(req, res) {
  try {
    const registrant = await VipRegistrant.findOneAndUpdate(
      { _id: req.params.id, organizationId: orgId(req) },
      { $set: { checkedOut: true, checkedOutAt: new Date() } },
      { new: true }
    );
    if (!registrant) return res.status(404).json({ message: 'VIP registrant not found' });
    res.json(registrant);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ─── 11. Registrant import ────────────────────────────────────────────────────

/**
 * Flexible column header → field mapping.
 * Keys are canonical field names; values are arrays of recognised aliases
 * (all lowercase — headers are lowercased before lookup).
 */
const IMPORT_COLUMN_ALIASES = {
  firstName:     ['first name', 'firstname', 'first_name', 'given name', 'givenname'],
  lastName:      ['last name', 'lastname', 'last_name', 'surname', 'family name', 'familyname'],
  email:         ['email', 'email address', 'e-mail', 'emailaddress', 'email_address'],
  phone:         ['phone', 'phone number', 'telephone', 'tel', 'phonenumber', 'phone_number'],
  mobile:        ['mobile', 'mobile number', 'cell', 'cellphone', 'mobilenumber', 'mobile_number'],
  landline:      ['landline', 'landline number', 'fixed line', 'fixedline', 'landline_number'],
  gender:        ['gender', 'sex'],
  country:       ['country', 'country name', 'nationality', 'countryname', 'country_name'],
  title:         ['title', 'salutation', 'honorific', 'mr/mrs', 'prefix'],
  hearAbout:     ['hear about', 'heard about', 'how did you hear', 'source', 'hearabout', 'hear_about'],
  wingType:      ['wing type', 'wing', 'category', 'wingtype', 'wing_type'],
  sessionName:   ['session', 'session name', 'track', 'sessionname', 'session_name'],
  checkedIn:     ['checked in', 'checkedin', 'check-in', 'check in status', 'checkin', 'check_in'],
  paymentStatus: ['payment', 'payment status', 'paymentstatus', 'payment_status'],
  qrCode:        ['qr code', 'qr', 'barcode', 'badge code', 'qrcode', 'qr_code'],
};

// Build reverse map: "first name" → "firstName", etc.
const HEADER_TO_FIELD = {};
for (const [field, aliases] of Object.entries(IMPORT_COLUMN_ALIASES)) {
  HEADER_TO_FIELD[field.toLowerCase()] = field;
  for (const alias of aliases) HEADER_TO_FIELD[alias] = field;
}

function cellStr(row, colNum) {
  if (!colNum) return '';
  const v = row.getCell(colNum).value;
  if (v === null || v === undefined) return '';
  // ExcelJS may give RichText objects or Date objects
  if (typeof v === 'object' && v.text) return String(v.text).trim();
  if (v instanceof Date)              return v.toISOString().slice(0, 10);
  return String(v).trim();
}

async function importRegistrants(req, res) {
  try {
    const oId = orgId(req);

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // ── Load event ────────────────────────────────────────────
    const event = await Event.findOne({ organizationId: oId }).lean();
    if (!event) return res.status(404).json({ message: 'No event found for this organisation' });

    // ── Parse workbook ────────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    try {
      const mimetype = req.file.mimetype;
      if (mimetype === 'text/csv' || mimetype === 'application/csv'
          || /\.csv$/i.test(req.file.originalname)) {
        await workbook.csv.load(req.file.buffer);
      } else {
        await workbook.xlsx.load(req.file.buffer);
      }
    } catch {
      return res.status(400).json({ message: 'Could not parse file — make sure it is a valid .xlsx or .csv' });
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      return res.status(400).json({ message: 'Spreadsheet is empty or has no data rows' });
    }

    // ── Map header row → column numbers ───────────────────────
    const headerRow = sheet.getRow(1);
    const colMap    = {};   // fieldName → colNumber
    const colNames  = {};   // colNumber → raw header string (for custom fields)

    headerRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
      const raw   = (cell.value?.toString() || '').trim();
      const lower = raw.toLowerCase();
      colNames[colNum] = raw;
      const field = HEADER_TO_FIELD[lower];
      if (field && !colMap[field]) colMap[field] = colNum;
    });

    // ── Session name → _id map ────────────────────────────────
    const sessionMap = {};
    (event.sessions || []).forEach((s) => {
      sessionMap[s.name.toLowerCase().trim()] = s._id;
    });

    // ── Process data rows ─────────────────────────────────────
    const results = { total: 0, imported: 0, updated: 0, skipped: 0, errors: [] };

    for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
      const row = sheet.getRow(rowNum);

      // Skip visually blank rows
      let hasContent = false;
      row.eachCell({ includeEmpty: false }, () => { hasContent = true; });
      if (!hasContent) continue;

      results.total++;

      const get = (field) => cellStr(row, colMap[field]);

      // ── Required fields ───────────────────────────────────
      const firstName = get('firstName');
      const lastName  = get('lastName');
      const email     = get('email').toLowerCase();

      if (!firstName) {
        results.errors.push({ row: rowNum, reason: 'Missing First Name' });
        results.skipped++;
        continue;
      }
      if (!lastName) {
        results.errors.push({ row: rowNum, reason: 'Missing Last Name' });
        results.skipped++;
        continue;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.errors.push({ row: rowNum, reason: `Invalid or missing email: "${email}"` });
        results.skipped++;
        continue;
      }

      // ── Optional fields ───────────────────────────────────
      const sessionName   = get('sessionName');
      const rawPayment    = get('paymentStatus').toLowerCase();
      const rawCheckedIn  = get('checkedIn').toLowerCase();
      const existingQr    = get('qrCode');

      const sessionId = sessionName
        ? (sessionMap[sessionName.toLowerCase()] || undefined)
        : undefined;

      const paymentStatus = ['free', 'pending', 'paid'].includes(rawPayment)
        ? rawPayment : 'free';

      const checkedIn = ['true', '1', 'yes', 'y', 'checked in'].includes(rawCheckedIn);

      // ── Custom fields (any unrecognised column) ───────────
      const customFields = {};
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        // Skip columns already mapped to standard fields
        const isStandard = Object.values(colMap).includes(colNum);
        if (!isStandard && colNames[colNum]) {
          const v = cellStr(row, colNum);
          if (v) customFields[colNames[colNum]] = v;
        }
      });

      // ── Build update doc ──────────────────────────────────
      const doc = {};
      if (firstName)                   doc.firstName     = firstName;
      if (lastName)                    doc.lastName      = lastName;
      if (get('phone'))                doc.phone         = get('phone');
      if (get('mobile'))               doc.mobile        = get('mobile');
      if (get('landline'))             doc.landline      = get('landline');
      if (get('gender'))               doc.gender        = get('gender');
      if (get('country'))              doc.country       = get('country');
      if (get('title'))                doc.title         = get('title');
      if (get('hearAbout'))            doc.hearAbout     = get('hearAbout');
      if (get('wingType'))             doc.wingType      = get('wingType');
      if (sessionId)                   doc.sessionId     = sessionId;
      if (paymentStatus !== 'free' || rawPayment) doc.paymentStatus = paymentStatus;
      if (checkedIn)                   doc.checkedIn     = true;
      if (checkedIn && !doc.checkedInAt) doc.checkedInAt = new Date();
      if (Object.keys(customFields).length) doc.customFields = customFields;

      try {
        const existing = await Registrant.findOne({ organizationId: oId, eventId: event._id, email }).lean();

        if (existing) {
          await Registrant.updateOne({ _id: existing._id }, { $set: doc });
          results.updated++;
        } else {
          await Registrant.create({
            ...doc,
            email,
            organizationId: oId,
            eventId:        event._id,
            qrCode:         existingQr || crypto.randomUUID(),
            paymentStatus,
          });
          results.imported++;
        }
      } catch (err) {
        const msg = err.code === 11000
          ? 'Duplicate QR code — a new one will be assigned on retry'
          : err.message;
        results.errors.push({ row: rowNum, reason: msg });
        results.skipped++;
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Import failed', error: err.message });
  }
}

/**
 * Generate and download a blank import template (.xlsx) with
 * column headers, a brief description row, and two example rows.
 */
async function downloadImportTemplate(req, res) {
  try {
    const wb  = new ExcelJS.Workbook();
    const ws  = wb.addWorksheet('Registrants');

    const COLS = [
      { header: 'First Name',     key: 'firstName',     note: 'Required' },
      { header: 'Last Name',      key: 'lastName',      note: 'Required' },
      { header: 'Email',          key: 'email',         note: 'Required — must be unique per event' },
      { header: 'Phone',          key: 'phone',         note: 'Optional' },
      { header: 'Mobile',         key: 'mobile',        note: 'Optional' },
      { header: 'Landline',       key: 'landline',      note: 'Optional' },
      { header: 'Gender',         key: 'gender',        note: 'Optional' },
      { header: 'Country',        key: 'country',       note: 'Optional' },
      { header: 'Title',          key: 'title',         note: 'Optional — Mr, Mrs, Dr, etc.' },
      { header: 'Session',        key: 'session',       note: 'Optional — must match a session name exactly' },
      { header: 'Hear About',     key: 'hearAbout',     note: 'Optional' },
      { header: 'Checked In',     key: 'checkedIn',     note: 'Optional — yes / no' },
      { header: 'Payment Status', key: 'paymentStatus', note: 'Optional — free / pending / paid (default: free)' },
      { header: 'QR Code',        key: 'qrCode',        note: 'Optional — leave blank to auto-generate' },
    ];

    // ── Column widths + header row ─────────────────────────
    ws.columns = COLS.map((c) => ({ header: c.header, key: c.key, width: 22 }));

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.font      = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    headerRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height    = 22;
    headerRow.commit();

    // ── Notes row (row 2, greyed out) ─────────────────────
    const noteRow = ws.addRow(COLS.map((c) => c.note));
    noteRow.font      = { italic: true, size: 9, color: { argb: 'FF94A3B8' } };
    noteRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    noteRow.alignment = { horizontal: 'center' };
    noteRow.height    = 16;
    noteRow.commit();

    // ── Two example rows (row 3 & 4) ──────────────────────
    const examples = [
      ['Jane', 'Smith', 'jane.smith@example.com', '+1-555-0100', '', '', 'Female', 'United States', 'Ms.', 'Morning Session', 'Word of Mouth / Friend or Colleague', 'no',  'free',    ''],
      ['Ahmed', 'Al-Rashid', 'ahmed@example.com', '+966-50-0000001', '', '', 'Male', 'Saudi Arabia', 'Mr.', 'Afternoon Session', 'Social Media', 'yes', 'paid', ''],
    ];
    for (const ex of examples) {
      const r = ws.addRow(ex);
      r.font      = { size: 10 };
      r.alignment = { vertical: 'middle' };
      r.height    = 18;
      r.commit();
    }

    // ── Freeze header + notes rows ─────────────────────────
    ws.views = [{ state: 'frozen', ySplit: 2 }];

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="import-template.xlsx"');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ message: 'Could not generate template', error: err.message });
  }
}

// ─── Waitlist — standard ─────────────────────────────────────────────────────

async function listWaitlist(req, res) {
  try {
    const id    = orgId(req);
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;
    const { search, sessionId, status } = req.query;

    const filter = { organizationId: id };
    if (sessionId && mongoose.isValidObjectId(sessionId)) {
      filter.sessionId = new mongoose.Types.ObjectId(sessionId);
    }
    if (status) filter.status = status;
    if (search) {
      const re = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ firstName: re }, { lastName: re }, { email: re }];
    }

    const [entries, total] = await Promise.all([
      WaitlistRegistrant.find(filter).sort({ waitlistPosition: 1, createdAt: 1 }).skip(skip).limit(limit),
      WaitlistRegistrant.countDocuments(filter),
    ]);

    res.json({ data: entries, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ─── Waitlist — VIP ──────────────────────────────────────────────────────────

async function listVipWaitlist(req, res) {
  try {
    const id    = orgId(req);
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;
    const { search, sessionId, status } = req.query;

    const filter = { organizationId: id };
    if (sessionId && mongoose.isValidObjectId(sessionId)) {
      filter.sessionId = new mongoose.Types.ObjectId(sessionId);
    }
    if (status) filter.status = status;
    if (search) {
      const re = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ firstName: re }, { lastName: re }, { email: re }];
    }

    const [entries, total] = await Promise.all([
      VipWaitlistRegistrant.find(filter).sort({ waitlistPosition: 1, createdAt: 1 }).skip(skip).limit(limit),
      VipWaitlistRegistrant.countDocuments(filter),
    ]);

    res.json({ data: entries, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

module.exports = {
  getEvent, updateEvent, addSession, updateSession, deleteSession,
  getPageConfig, updatePageConfig, uploadLogo, uploadPageBanner, uploadVipPageBanner,
  getEmailTemplate, updateEmailTemplate, uploadEmailImage, sendTestEmail,
  getVipEmailTemplate, updateVipEmailTemplate, uploadVipEmailImage, sendTestVipEmail,
  updatePaymentSettings,
  listRegistrants, exportRegistrants, searchRegistrant, getRegistrant, checkIn, checkOut,
  getBadgeConfig, updateBadgeConfig, uploadBadgeBackground,
  getVipPageConfig, updateVipPageConfig, uploadVipLogo,
  listVipRegistrants, exportVipRegistrants, searchVipRegistrant, checkInVip, checkOutVip,
  listWaitlist, listVipWaitlist,
  getLookups,
  getDashboardStats,
  importRegistrants,
  downloadImportTemplate,
};
