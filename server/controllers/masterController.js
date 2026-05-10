const bcrypt        = require('bcryptjs');
const mongoose      = require('mongoose');
const { Organization, Event, PageConfig, EmailTemplate, VipEmailTemplate, Registrant,
        Title, Country, SponsorType, HearAbout, RegisterInterest } = require('../models');
const { uniqueSlug, toSlug } = require('../utils/slug');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Lookup type → model map ────────────────────────────────────────────────

const LOOKUP_MODELS = { Title, Country, SponsorType, HearAbout, RegisterInterest };
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
};
