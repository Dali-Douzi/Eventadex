const bcrypt        = require('bcryptjs');
const mongoose      = require('mongoose');
const ExcelJS       = require('exceljs');
const PDFDocument   = require('pdfkit');
const { Organization, Event, PageConfig, EmailTemplate, VipEmailTemplate, Registrant,
        Title, Country, HearAbout, Visitor } = require('../models');
const { uniqueSlug, toSlug } = require('../utils/slug');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Lookup type → model map ────────────────────────────────────────────────

const LOOKUP_MODELS = { Title, Country, HearAbout };
const LOOKUP_TYPES  = Object.keys(LOOKUP_MODELS);

function getLookupModel(type) {
  // Normalise: "wingtype" or "WingType" both work
  const key = LOOKUP_TYPES.find(k => k.toLowerCase() === type.toLowerCase());
  return key ? LOOKUP_MODELS[key] : null;
}

// ─── Organization management ─────────────────────────────────────────────────

async function listOrganizations(req, res) {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip   = (page - 1) * limit;
    const { search, status } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const re = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ name: re }, { email: re }];
    }

    const [orgs, total] = await Promise.all([
      Organization.find(filter)
        .select('-password')
        .populate({ path: 'eventId', select: 'name eventType startDate status' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Organization.countDocuments(filter),
    ]);

    res.json({ data: orgs, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function createOrganization(req, res) {
  try {
    const { name, email, password, eventType } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }

    const existing = await Organization.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: 'An organization with this email already exists' });

    const slug   = await uniqueSlug(name);
    const hashed = await bcrypt.hash(password, 10);

    // Use a session so all linked documents are created atomically
    const session = await mongoose.startSession();
    let org;
    await session.withTransaction(async () => {
      [org] = await Organization.create([{ name: name.trim(), email: email.toLowerCase().trim(), password: hashed, slug }], { session });

      const [event] = await Event.create([{
        organizationId: org._id,
        name:           `${name.trim()} Event`,
        eventType:      eventType || 'Conference',
        startDate:      new Date(),
        endDate:        new Date(),
        status:         'draft',
      }], { session });

      // Link event back to org
      await Organization.findByIdAndUpdate(org._id, { eventId: event._id }, { session });

      await PageConfig.create([{
        organizationId: org._id,
        formFields: [
          { fieldName: 'firstName', label: 'First Name', type: 'text',   required: true,  visible: true },
          { fieldName: 'lastName',  label: 'Last Name',  type: 'text',   required: true,  visible: true },
          { fieldName: 'gender',    label: 'Salutation', type: 'radio',  required: false, visible: true,
            options: ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'] },
          { fieldName: 'email',     label: 'Email',      type: 'email',  required: true,  visible: true },
        ],
      }], { session });
      await EmailTemplate.create([{
        organizationId: org._id,
        subject:        `Your registration for ${name.trim()}`,
      }], { session });
      await VipEmailTemplate.create([{
        organizationId: org._id,
        subject:        `Your VIP registration for ${name.trim()}`,
      }], { session });
    });
    session.endSession();

    const result = await Organization.findById(org._id).select('-password');
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function getOrganization(req, res) {
  try {
    const org = await Organization.findById(req.params.id).select('-password').populate('eventId');
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.json(org);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function updateOrganization(req, res) {
  try {
    const { name, email, slug, status } = req.body;
    const update = {};

    if (name   !== undefined) update.name   = name.trim();
    if (email  !== undefined) update.email  = email.toLowerCase().trim();
    if (status !== undefined) update.status = status;

    if (slug !== undefined) {
      const normalized = toSlug(slug);
      const conflict = await Organization.findOne({ slug: normalized, _id: { $ne: req.params.id } });
      if (conflict) return res.status(409).json({ message: 'Slug already in use' });
      update.slug = normalized;
    }

    const org = await Organization.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-password');
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.json(org);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function resetOrgPassword(req, res) {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'password is required' });

    const hashed = await bcrypt.hash(password, 10);
    const org    = await Organization.findByIdAndUpdate(req.params.id, { password: hashed }, { new: true }).select('-password');
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function updateOrgPermissions(req, res) {
  try {
    const allowed = ['canExportData', 'canCheckIn', 'canViewVip', 'canEditPageBuilder'];
    const perms = {};
    allowed.forEach((k) => {
      if (typeof req.body[k] === 'boolean') perms[`permissions.${k}`] = req.body[k];
    });
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { $set: perms },
      { new: true }
    ).select('-password');
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.json(org);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function deleteOrganization(req, res) {
  try {
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { status: 'deleted' },
      { new: true }
    ).select('-password');
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.json({ message: 'Organization deleted', org });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function banishOrganization(req, res) {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ message: 'Organization not found' });

    const orgId = org._id;

    // Cascade-delete all data belonging to this organization
    await Promise.all([
      Event.deleteMany({ organizationId: orgId }),
      PageConfig.deleteMany({ organizationId: orgId }),
      EmailTemplate.deleteMany({ organizationId: orgId }),
      Registrant.deleteMany({ organizationId: orgId }),
    ]);

    await Organization.findByIdAndDelete(orgId);

    res.json({ message: 'Organization permanently removed', orgId });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ─── Global lookup management ─────────────────────────────────────────────────

async function listLookups(req, res) {
  try {
    const Model = getLookupModel(req.params.type);
    if (!Model) return res.status(400).json({ message: `Invalid lookup type. Allowed: ${LOOKUP_TYPES.join(', ')}` });

    const { search, status } = req.query;
    const filter = { organizationId: null };
    if (status) filter.status = status;
    if (search) filter.name = new RegExp(escapeRegex(search.trim()), 'i');

    const items = await Model.find(filter).sort({ name: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function createLookup(req, res) {
  try {
    const Model = getLookupModel(req.params.type);
    if (!Model) return res.status(400).json({ message: `Invalid lookup type. Allowed: ${LOOKUP_TYPES.join(', ')}` });

    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });

    const item = await Model.create({ name: name.trim(), organizationId: null });
    res.status(201).json(item);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'An entry with this name already exists' });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function updateLookup(req, res) {
  try {
    const Model = getLookupModel(req.params.type);
    if (!Model) return res.status(400).json({ message: `Invalid lookup type. Allowed: ${LOOKUP_TYPES.join(', ')}` });

    const { name, status } = req.body;
    const update = {};
    if (name   !== undefined) update.name   = name.trim();
    if (status !== undefined) update.status = status;

    const item = await Model.findOneAndUpdate(
      { _id: req.params.id, organizationId: null },
      update,
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ message: 'Lookup entry not found' });
    res.json(item);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'An entry with this name already exists' });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function deleteLookup(req, res) {
  try {
    const Model = getLookupModel(req.params.type);
    if (!Model) return res.status(400).json({ message: `Invalid lookup type. Allowed: ${LOOKUP_TYPES.join(', ')}` });

    const item = await Model.findOneAndUpdate(
      { _id: req.params.id, organizationId: null },
      { status: 'deleted' },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Lookup entry not found' });
    res.json({ message: 'Lookup entry deleted', item });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function banishLookup(req, res) {
  try {
    const Model = getLookupModel(req.params.type);
    if (!Model) return res.status(400).json({ message: `Invalid lookup type. Allowed: ${LOOKUP_TYPES.join(', ')}` });

    const item = await Model.findOneAndDelete({ _id: req.params.id, organizationId: null });
    if (!item) return res.status(404).json({ message: 'Lookup entry not found' });
    res.json({ message: 'Lookup entry permanently removed', itemId: req.params.id });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ─── Platform stats ───────────────────────────────────────────────────────────

async function getStats(req, res) {
  try {
    const [totalOrgs, activeOrgs, totalRegistrants, totalEvents, byTypeRaw, recentOrgs] = await Promise.all([
      Organization.countDocuments({ status: { $ne: 'deleted' } }),
      Organization.countDocuments({ status: 'active' }),
      Registrant.countDocuments(),
      Event.countDocuments(),
      // Count events grouped by eventType
      Event.aggregate([
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // 5 most recently created orgs (for quick overview)
      Organization.find({ status: { $ne: 'deleted' } })
        .select('name email status createdAt')
        .populate({ path: 'eventId', select: 'name eventType status' })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const eventsByType = byTypeRaw.reduce((acc, { _id, count }) => {
      if (_id) acc[_id] = count;
      return acc;
    }, {});

    res.json({ totalOrgs, activeOrgs, totalRegistrants, totalEvents, eventsByType, recentOrgs });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ─── Export organizations ────────────────────────────────────────────────────

const ORG_COLS = [
  { label: 'Name',        key: (o) => o.name                                                  },
  { label: 'Email',       key: (o) => o.email                                                 },
  { label: 'Slug',        key: (o) => o.slug                                                  },
  { label: 'Status',      key: (o) => o.status                                                },
  { label: 'Event',       key: (o) => o.eventId?.name       || ''                             },
  { label: 'Event Type',  key: (o) => o.eventId?.eventType  || ''                             },
  { label: 'Event Start', key: (o) => o.eventId?.startDate  ? new Date(o.eventId.startDate).toLocaleDateString('en-GB') : '' },
  { label: 'Registrants', key: (o) => o.registrantCount ?? ''                                 },
  { label: 'Created',     key: (o) => new Date(o.createdAt).toISOString()                     },
];

async function exportOrganizations(req, res) {
  try {
    const { format = 'csv' } = req.query;

    // Fetch all orgs with event info + registrant counts
    const orgs = await Organization.find({})
      .select('-password')
      .populate({ path: 'eventId', select: 'name eventType startDate' })
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean();

    // Attach registrant counts
    const counts = await Registrant.aggregate([
      { $group: { _id: '$organizationId', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));
    orgs.forEach((o) => { o.registrantCount = countMap[o._id.toString()] ?? 0; });

    const ts = Date.now();

    // ── CSV ─────────────────────────────────────────────────
    if (format === 'csv') {
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = ORG_COLS.map((c) => esc(c.label)).join(',');
      const rows   = orgs.map((o) => ORG_COLS.map((c) => esc(c.key(o))).join(','));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="organizations-${ts}.csv"`);
      return res.send([header, ...rows].join('\n'));
    }

    // ── XLSX ────────────────────────────────────────────────
    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Organizations');
      ws.columns = ORG_COLS.map((c) => ({ header: c.label, width: Math.max(c.label.length + 2, 16) }));
      ws.getRow(1).font = { bold: true };
      orgs.forEach((o) => ws.addRow(ORG_COLS.map((c) => c.key(o))));
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="organizations-${ts}.xlsx"`);
      return res.send(buf);
    }

    // ── PDF ─────────────────────────────────────────────────
    if (format === 'pdf') {
      const PDF_COLS = [
        { label: 'Name',        key: (o) => o.name,                        w: 110 },
        { label: 'Email',       key: (o) => o.email,                       w: 130 },
        { label: 'Status',      key: (o) => o.status,                      w:  55 },
        { label: 'Event',       key: (o) => o.eventId?.name       || '',   w: 110 },
        { label: 'Event Type',  key: (o) => o.eventId?.eventType  || '',   w:  85 },
        { label: 'Registrants', key: (o) => String(o.registrantCount ?? 0), w:  60 },
        { label: 'Created',     key: (o) => new Date(o.createdAt).toLocaleDateString('en-GB'), w: 70 },
      ];

      const buf = await new Promise((resolve, reject) => {
        const doc    = new PDFDocument({ margin: 28, size: 'A4', layout: 'landscape' });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end',  () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const pageW  = doc.page.width - 56;
        const totalW = PDF_COLS.reduce((s, c) => s + c.w, 0);
        const scale  = pageW / totalW;
        const colWs  = PDF_COLS.map((c) => c.w * scale);

        doc.fontSize(14).fillColor('#1e293b').text('Organizations Export', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor('#64748b').text(
          `Generated ${new Date().toLocaleString()} · ${orgs.length} record${orgs.length !== 1 ? 's' : ''}`,
          { align: 'center' }
        );
        doc.moveDown(0.6);

        const ROW_H = 18, FONT_SM = 7.5, PAD = 4;
        let x = doc.page.margins.left;
        let y = doc.y;

        doc.rect(x, y, pageW, ROW_H).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(FONT_SM);
        let cx = x;
        PDF_COLS.forEach((col, i) => {
          doc.text(col.label, cx + PAD, y + 5, { width: colWs[i] - PAD * 2, lineBreak: false, ellipsis: true });
          cx += colWs[i];
        });
        y += ROW_H;

        doc.fillColor('#1e293b');
        orgs.forEach((o, ri) => {
          if (y + ROW_H > doc.page.height - doc.page.margins.bottom) {
            doc.addPage(); y = doc.page.margins.top;
          }
          if (ri % 2 === 0) doc.rect(x, y, pageW, ROW_H).fill('#f8fafc');
          doc.fillColor('#1e293b').fontSize(FONT_SM);
          cx = x;
          PDF_COLS.forEach((col, i) => {
            doc.text(String(col.key(o)), cx + PAD, y + 5, { width: colWs[i] - PAD * 2, lineBreak: false, ellipsis: true });
            cx += colWs[i];
          });
          doc.moveTo(x, y + ROW_H).lineTo(x + pageW, y + ROW_H).strokeColor('#e2e8f0').lineWidth(0.4).stroke();
          y += ROW_H;
        });

        doc.end();
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="organizations-${ts}.pdf"`);
      return res.send(buf);
    }

    res.status(400).json({ message: 'Invalid format. Use csv, xlsx, or pdf.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ─── Visitors ─────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const CSV_ROOT = path.resolve(__dirname, '../../');

const CSV_FILES = [
  {
    file: path.join(CSV_ROOT, '2025 visitor.csv'),
    year: 2025,
    isHeader: false,
    parse: (line) => {
      const email = line.trim().toLowerCase();
      return email && email.includes('@') ? { email, year: 2025 } : null;
    },
  },
  {
    file: path.join(CSV_ROOT, 'visitor 2024.csv'),
    year: 2024,
    isHeader: true,
    parse: (line, isFirst) => {
      if (isFirst) return null;
      const cols = parseCSVLine(line);
      const email = (cols[0] || '').trim().toLowerCase();
      if (!email || !email.includes('@')) return null;
      return {
        email,
        klaviyoId:    (cols[1] || '').trim() || undefined,
        firstName:    (cols[2] || '').trim() || undefined,
        lastName:     (cols[3] || '').trim() || undefined,
        locale:       (cols[4] || '').trim() || undefined,
        title:        (cols[5] || '').trim() || undefined,
        organization: (cols[6] || '').trim() || undefined,
        phone:        (cols[7] || '').trim() || undefined,
        address:      (cols[8] || '').trim() || undefined,
        year:         2024,
      };
    },
  },
];

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

// Guard: only one import can run at a time
let importRunning = false;

async function importCSVFile({ file, year, isHeader, parse }) {
  if (!fs.existsSync(file)) return { inserted: 0, updated: 0, skipped: 0, error: 'File not found' };

  // Read entire file into memory — avoids readline stream issues
  const content = fs.readFileSync(file, 'utf8');
  const lines   = content.split(/\r?\n/);

  let inserted = 0, updated = 0, skipped = 0;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    if (!line.trim()) continue; // skip blank lines

    const doc = parse(line, lineNum === 0 && isHeader);
    if (!doc) continue;

    // Strip undefined values
    Object.keys(doc).forEach((k) => doc[k] === undefined && delete doc[k]);

    try {
      if (year === 2025) {
        // Email-only — only insert if brand new, never overwrite existing data
        const result = await Visitor.updateOne(
          { email: doc.email },
          { $setOnInsert: doc },
          { upsert: true }
        );
        if (result.upsertedCount) inserted++;
        else skipped++;
      } else {
        // 2024 — rich data: always upsert/enrich
        const result = await Visitor.updateOne(
          { email: doc.email },
          { $set: doc },
          { upsert: true }
        );
        if (result.upsertedCount) inserted++;
        else updated++;
      }
    } catch { skipped++; }
  }

  return { inserted, updated, skipped };
}

async function importVisitorsFromCSV(req, res) {
  if (importRunning) {
    return res.status(409).json({ message: 'Import already in progress, please wait.' });
  }
  importRunning = true;
  try {
    const results = {};
    for (const cfg of CSV_FILES) {
      results[cfg.year] = await importCSVFile(cfg);
    }
    const total     = await Visitor.countDocuments();
    const count2024 = await Visitor.countDocuments({ year: 2024 });
    const count2025 = await Visitor.countDocuments({ year: 2025 });
    res.json({ results, totalInDB: total, count2024, count2025 });
  } catch (err) {
    res.status(500).json({ message: 'Import failed', error: err.message });
  } finally {
    importRunning = false;
  }
}

async function listVisitors(req, res) {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.year) filter.year = parseInt(req.query.year);
    if (req.query.search) {
      const re = new RegExp(escapeRegex(req.query.search.trim()), 'i');
      filter.$or = [{ email: re }, { firstName: re }, { lastName: re }, { organization: re }];
    }

    const [data, total] = await Promise.all([
      Visitor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Visitor.countDocuments(filter),
    ]);

    const [count2024, count2025] = await Promise.all([
      Visitor.countDocuments({ year: 2024 }),
      Visitor.countDocuments({ year: 2025 }),
    ]);

    res.json({ data, total, page, pages: Math.ceil(total / limit), count2024, count2025 });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function clearVisitors(req, res) {
  try {
    const { deletedCount } = await Visitor.deleteMany({});
    console.log(`[Visitors] Cleared ${deletedCount} records`);
    res.json({ deletedCount });
  } catch (err) {
    res.status(500).json({ message: 'Clear failed', error: err.message });
  }
}

async function resetAndImportVisitors(req, res) {
  if (importRunning) {
    return res.status(409).json({ message: 'Import already in progress.' });
  }
  importRunning = true;
  try {
    console.log('[Visitors] Checking CSV files…');
    for (const cfg of CSV_FILES) {
      const exists = fs.existsSync(cfg.file);
      console.log(`  ${cfg.year}: ${cfg.file} — ${exists ? 'FOUND' : 'NOT FOUND'}`);
    }

    console.log('[Visitors] Wiping collection…');
    await Visitor.deleteMany({});

    const results = {};
    for (const cfg of CSV_FILES) {
      console.log(`[Visitors] Importing ${cfg.year}…`);
      results[cfg.year] = await importCSVFile(cfg);
      console.log(`[Visitors] ${cfg.year} done:`, results[cfg.year]);
    }

    const total     = await Visitor.countDocuments();
    const count2024 = await Visitor.countDocuments({ year: 2024 });
    const count2025 = await Visitor.countDocuments({ year: 2025 });
    console.log(`[Visitors] Import complete — total: ${total}, 2024: ${count2024}, 2025: ${count2025}`);
    res.json({ results, totalInDB: total, count2024, count2025 });
  } catch (err) {
    console.error('[Visitors] Reset + import error:', err);
    res.status(500).json({ message: 'Reset + import failed', error: err.message, stack: err.stack });
  } finally {
    importRunning = false;
  }
}

module.exports = {
  listOrganizations,
  createOrganization,
  getOrganization,
  updateOrganization,
  resetOrgPassword,
  updateOrgPermissions,
  deleteOrganization,
  banishOrganization,
  listLookups,
  createLookup,
  updateLookup,
  deleteLookup,
  banishLookup,
  getStats,
  exportOrganizations,
  listVisitors,
  importVisitorsFromCSV,
  resetAndImportVisitors,
  clearVisitors,
};
