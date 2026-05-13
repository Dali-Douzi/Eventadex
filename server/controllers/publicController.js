'use strict';

const mongoose = require('mongoose');
const crypto   = require('crypto');          // built-in — randomUUID()
const https    = require('https');
const QRCode   = require('qrcode');

// ─── reCAPTCHA verification ───────────────────────────────────────────────────
function verifyCaptcha(token) {
  // Skip real HTTP call in test/E2E environments
  if (process.env.NODE_ENV === 'test') return Promise.resolve(true);
  if (process.env.SKIP_CAPTCHA === 'true') return Promise.resolve(true);
  return new Promise((resolve) => {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret || !token) return resolve(false);
    const body = `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`;
    const req = https.request(
      { hostname: 'www.google.com', path: '/recaptcha/api/siteverify', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data).success === true); }
          catch { resolve(false); }
        });
      }
    );
    req.on('error', () => resolve(false));
    req.write(body);
    req.end();
  });
}

const {
  Organization,
  Event,
  PageConfig,
  EmailTemplate,
  Registrant,
  VipRegistrant,
  VipPageConfig,
  VipEmailTemplate,
  Title, Country, HearAbout,
} = require('../models');

const { sendConfirmationEmail } = require('../services/emailService');

// Fields handled explicitly — anything else in formFields is a "custom" field
const STANDARD_FIELD_NAMES = new Set([
  'firstName', 'lastName', 'email', 'phone', 'landline', 'mobile',
  'gender', 'country', 'title', 'hearAbout',
  'sessionId', 'paymentIntentId',
]);

// ─── Moyasar payment verification ────────────────────────────────────────────

/** Convert a ticket price to the smallest currency unit Moyasar expects. */
function toSmallestUnit(amount, currency) {
  const threeDecimal = ['KWD', 'BHD', 'OMR'];
  const factor = threeDecimal.includes((currency || '').toUpperCase()) ? 1000 : 100;
  return Math.round(amount * factor);
}

/** Fetch a Moyasar payment by ID using the secret key (HTTP Basic Auth). */
function fetchMoyasarPayment(paymentId) {
  const key = process.env.MOYASAR_SECRET_KEY;
  if (!key) return Promise.reject(new Error('MOYASAR_SECRET_KEY is not configured'));

  const auth = Buffer.from(`${key}:`).toString('base64');

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.moyasar.com',
        path:     `/v1/payments/${encodeURIComponent(paymentId)}`,
        method:   'GET',
        headers:  { Authorization: `Basic ${auth}` },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid response from Moyasar')); }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Find an active org by slug. Returns null if not found or suspended/deleted. */
function findActiveOrg(slug) {
  return Organization.findOne({ slug: slug.toLowerCase(), status: 'active' });
}

/** Find a published event for an org. */
function findPublishedEvent(orgId) {
  return Event.findOne({ organizationId: orgId, status: 'published' });
}

/** Load lookup table (global + org-specific available items). */
function loadLookup(Model, orgId) {
  return Model.find(
    { $or: [{ organizationId: null }, { organizationId: orgId }], status: 'available' },
    'name',
    { sort: { name: 1 } }
  );
}

/** Enrich sessions with calculated remaining capacity. */
function enrichSessions(sessions) {
  return (sessions || []).map((s) => ({
    _id:               s._id,
    name:              s.name,
    date:              s.date,
    capacity:          s.capacity,
    waitlistCapacity:  s.waitlistCapacity,
    registered:        s.registered || 0,
    remainingCapacity: Math.max(0, s.capacity - (s.registered || 0)),
    isFull:            (s.registered || 0) >= s.capacity,
  }));
}

/** Resolve a lookup ObjectId to the document's name. Returns null on no match. */
function resolveLookupId(Model, id) {
  if (!id || !mongoose.isValidObjectId(id)) return Promise.resolve(null);
  return Model.findById(id).select('name').lean();
}

// ─── Custom field collector ───────────────────────────────────────────────────

/** Extract non-standard form field values from the request body. */
function collectCustomFields(formFields, body) {
  const result = {};
  for (const field of (formFields || [])) {
    if (STANDARD_FIELD_NAMES.has(field.fieldName) || field.visible === false) continue;
    const val = body[field.fieldName];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      result[field.fieldName] = String(val).trim().slice(0, 500);
    }
  }
  return Object.keys(result).length ? result : undefined;
}

// ─── QR code generation ───────────────────────────────────────────────────────

const QR_OPTS = { width: 300, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } };

async function generateQR(value) {
  return QRCode.toDataURL(value, QR_OPTS); // data:image/png;base64,...
}

// ─── 1. GET /api/public/:orgSlug ─────────────────────────────────────────────

async function getFormConfig(req, res) {
  try {
    const org = await findActiveOrg(req.params.orgSlug);
    if (!org) {
      return res.status(404).json({ error: 'Registration not found or not available' });
    }

    const event = await findPublishedEvent(org._id);
    if (!event) {
      return res.status(404).json({ error: 'Registration not found or not available' });
    }

    // Parallel: page config + lookup tables
    const [
      pageConfig,
      titles, countries, hearAbout,
    ] = await Promise.all([
      PageConfig.findOne({ organizationId: org._id }),
      loadLookup(Title,            org._id),
      loadLookup(Country,          org._id),
      loadLookup(HearAbout,        org._id),
    ]);

    const sessions = enrichSessions(event.sessions);

    return res.json({
      event: {
        name:           event.name,
        description:    event.description,
        startDate:      event.startDate,
        endDate:        event.endDate,
        paymentEnabled: event.paymentEnabled,
        ticketPrice:    event.ticketPrice,
        currency:       event.currency,
        sessions,
      },
      pageConfig: pageConfig || {},
      sessions,                              // top-level alias for easy access
      lookups: {
        titles,
        countries,
        hearAbout,
      },
    });
  } catch (err) {
    console.error('[public] getFormConfig error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── 2. POST /api/public/:orgSlug/create-payment-intent (removed) ────────────
// Payment is now handled entirely client-side by the Moyasar form widget.
// This endpoint is kept as a 410 Gone stub so old bookmarks/clients get a
// clear error instead of a confusing 404.
async function createPaymentIntent(req, res) {
  return res.status(410).json({ error: 'This endpoint has been removed. Payment is now handled by Moyasar.' });
}

// ─── 3. POST /api/public/:orgSlug/register ────────────────────────────────────

async function register(req, res) {
  try {
    // ── reCAPTCHA check ────────────────────────────────────────
    const captchaOk = await verifyCaptcha(req.body?.captchaToken);
    if (!captchaOk) {
      return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });
    }

    // ── Resolve org + event ────────────────────────────────────
    const org = await findActiveOrg(req.params.orgSlug);
    if (!org) {
      return res.status(404).json({ error: 'Registration not found or not available' });
    }

    const [event, pageConfig, emailTemplate] = await Promise.all([
      findPublishedEvent(org._id),
      PageConfig.findOne({ organizationId: org._id }),
      EmailTemplate.findOne({ organizationId: org._id }),
    ]);
    if (!event) {
      return res.status(404).json({ error: 'Registration not found or not available' });
    }

    const body = req.body || {};

    // ── Hard-required fields (always enforced) ─────────────────
    if (!body.firstName?.trim()) return res.status(400).json({ error: 'First name is required' });
    if (!body.lastName?.trim())  return res.status(400).json({ error: 'Last name is required' });
    if (!body.email?.trim())     return res.status(400).json({ error: 'Email is required' });
    if (!body.sessionId)         return res.status(400).json({ error: 'Session selection is required' });

    // ── Dynamic required field validation (from pageConfig) ────
    const requiredFields = (pageConfig?.formFields || []).filter(
      (f) => f.required === true && f.visible !== false
    );
    for (const field of requiredFields) {
      const name = field.fieldName;
      // Lookup fields arrive as <name>Id; scalar fields directly as <name>
      const val = body[name] ?? body[`${name}Id`];
      if (val === undefined || val === null || String(val).trim() === '') {
        return res.status(400).json({ error: `${field.label || name} is required` });
      }
    }

    // ── Payment verification (Moyasar) ────────────────────────
    let paymentStatus = 'free';
    if (event.paymentEnabled) {
      if (!body.paymentIntentId) {
        return res.status(400).json({ error: 'Payment is required for this event' });
      }

      let payment;
      try {
        payment = await fetchMoyasarPayment(body.paymentIntentId);
      } catch (err) {
        console.error('[public] Moyasar fetch error:', err.message);
        return res.status(400).json({ error: 'Could not verify payment. Please try again.' });
      }

      // 1. Status must be paid
      if (payment.status !== 'paid') {
        return res.status(400).json({
          error: `Payment has not been confirmed (status: ${payment.status})`,
        });
      }

      // 2. Amount must match — prevents price manipulation
      const expectedAmount = toSmallestUnit(event.ticketPrice, event.currency);
      if (payment.amount !== expectedAmount) {
        console.warn(
          `[public] Moyasar amount mismatch for org ${org._id}: ` +
          `expected ${expectedAmount}, got ${payment.amount}`
        );
        return res.status(400).json({
          error: 'Payment amount does not match the ticket price. Please restart the registration.',
        });
      }

      paymentStatus = 'paid';
    }

    // ── Session capacity check ─────────────────────────────────
    if (!mongoose.isValidObjectId(body.sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    const session = event.sessions.id(body.sessionId);
    if (!session) {
      return res.status(400).json({ error: 'Session not found' });
    }
    if ((session.registered || 0) >= session.capacity) {
      return res.status(400).json({ error: 'Session is full — no spots remaining' });
    }

    // ── Resolve lookup IDs → display names ────────────────────
    const [titleDoc, countryDoc, hearAboutDoc] =
      await Promise.all([
        resolveLookupId(Title,   body.titleId),
        resolveLookupId(Country, body.countryId),
        resolveLookupId(HearAbout, body.hearAboutId),
      ]);

    // ── Generate QR code ───────────────────────────────────────
    const qrCodeValue = crypto.randomUUID();          // unique identifier stored in DB
    const qrCodeImage = await generateQR(qrCodeValue); // base64 PNG for email + confirmation

    // ── Create registrant ──────────────────────────────────────
    const registrant = await Registrant.create({
      organizationId:   org._id,
      eventId:          event._id,
      sessionId:        new mongoose.Types.ObjectId(body.sessionId),
      firstName:        body.firstName.trim(),
      lastName:         body.lastName.trim(),
      email:            body.email.trim().toLowerCase(),
      phone:            body.phone?.trim()    || undefined,
      landline:         body.landline?.trim() || undefined,
      mobile:           body.mobile?.trim()   || undefined,
      gender:           body.gender?.trim()   || undefined,
      country:          countryDoc?.name      || undefined,
      title:            titleDoc?.name        || undefined,
      hearAbout:        hearAboutDoc?.name    || undefined,
      customFields:     collectCustomFields(pageConfig?.formFields, body),
      qrCode:           qrCodeValue,
      paymentStatus,
      paymentIntentId:  body.paymentIntentId  || undefined,
    });

    // ── Increment session.registered atomically ────────────────
    await Event.findOneAndUpdate(
      { organizationId: org._id, 'sessions._id': body.sessionId },
      { $inc: { 'sessions.$.registered': 1 } }
    );

    // ── Send confirmation email (fire and forget) ──────────────
    const baseUrl = process.env.CLIENT_USER_URL || '';
    sendConfirmationEmail({
      registrant:      registrant.toObject(),
      event:           { name: event.name },
      session:         { name: session.name, date: session.date },
      organization:    { name: org.name },
      emailTemplate,
      qrCodeDataUrl:   qrCodeImage,
      logoUrl:         pageConfig?.logoUrl || null,
      confirmationUrl: `${baseUrl}/${org.slug}/confirmation/${registrant._id}`,
    }).catch((emailErr) => {
      console.error('[public] Confirmation email failed:', emailErr.message);
    });

    return res.status(201).json({
      success:      true,
      registrantId: registrant._id,
      qrCode:       qrCodeImage, // base64 data URL for the confirmation page
    });

  } catch (err) {
    // Duplicate registration (unique index: orgId + eventId + email)
    if (err.code === 11000) {
      return res.status(409).json({
        error: 'This email address is already registered for this event',
      });
    }
    console.error('[public] register error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
}

// ─── 4. GET /api/public/:orgSlug/registrant/:id ───────────────────────────────

async function getRegistrantDetail(req, res) {
  try {
    const org = await findActiveOrg(req.params.orgSlug);
    if (!org) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid registrant ID' });
    }

    let registrant = await Registrant.findOne({
      _id:            req.params.id,
      organizationId: org._id,
    }).lean();

    if (!registrant) {
      registrant = await VipRegistrant.findOne({
        _id:            req.params.id,
        organizationId: org._id,
      }).lean();
    }

    if (!registrant) {
      return res.status(404).json({ error: 'Registrant not found' });
    }

    // Retrieve the event so we can attach the session name
    const event = await Event.findOne({ organizationId: org._id }).select('sessions name');
    const session = event?.sessions?.id
      ? event.sessions.id(registrant.sessionId?.toString())
      : null;

    // Generate QR image on demand (value is stored in DB, image is always derived)
    const qrCodeImage = await generateQR(registrant.qrCode);

    return res.json({
      ...registrant,
      qrCodeImage,
      sessionName: session?.name  || null,
      sessionDate: session?.date  || null,
      eventName:   event?.name    || null,
    });
  } catch (err) {
    console.error('[public] getRegistrantDetail error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── 5. GET /api/public/:orgSlug/vip ─────────────────────────────────────────

async function getVipFormConfig(req, res) {
  try {
    const org = await findActiveOrg(req.params.orgSlug);
    if (!org) {
      return res.status(404).json({ error: 'VIP registration not found or not available' });
    }

    const event = await findPublishedEvent(org._id);
    if (!event) {
      return res.status(404).json({ error: 'VIP registration not found or not available' });
    }

    const [
      vipPageConfig,
      titles, countries, hearAbout,
    ] = await Promise.all([
      VipPageConfig.findOne({ organizationId: org._id }),
      loadLookup(Title,            org._id),
      loadLookup(Country,          org._id),
      loadLookup(HearAbout,        org._id),
    ]);

    const sessions = enrichSessions(event.sessions);

    return res.json({
      event: {
        name:        event.name,
        description: event.description,
        startDate:   event.startDate,
        endDate:     event.endDate,
        sessions,
      },
      pageConfig: vipPageConfig || { primaryColor: '#1a1a2e', secondaryColor: '#e2b96f' },
      sessions,
      lookups: { titles, countries, hearAbout },
    });
  } catch (err) {
    console.error('[public] getVipFormConfig error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── 6. POST /api/public/:orgSlug/vip/register ────────────────────────────────

async function registerVip(req, res) {
  try {
    // ── reCAPTCHA check ────────────────────────────────────────
    const captchaOk = await verifyCaptcha(req.body?.captchaToken);
    if (!captchaOk) {
      return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });
    }

    const org = await findActiveOrg(req.params.orgSlug);
    if (!org) {
      return res.status(404).json({ error: 'VIP registration not found or not available' });
    }

    const [event, vipPageConfig, vipEmailTemplate, fallbackEmailTemplate] = await Promise.all([
      findPublishedEvent(org._id),
      VipPageConfig.findOne({ organizationId: org._id }),
      VipEmailTemplate.findOne({ organizationId: org._id }),
      EmailTemplate.findOne({ organizationId: org._id }),
    ]);
    // Use VIP-specific template when configured, otherwise fall back to regular template
    const emailTemplate = (vipEmailTemplate?.subject) ? vipEmailTemplate : fallbackEmailTemplate;
    if (!event) {
      return res.status(404).json({ error: 'VIP registration not found or not available' });
    }

    const body = req.body || {};

    if (!body.firstName?.trim()) return res.status(400).json({ error: 'First name is required' });
    if (!body.lastName?.trim())  return res.status(400).json({ error: 'Last name is required' });
    if (!body.email?.trim())     return res.status(400).json({ error: 'Email is required' });
    if (!body.sessionId)         return res.status(400).json({ error: 'Session selection is required' });

    if (!mongoose.isValidObjectId(body.sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    const session = event.sessions.id(body.sessionId);
    if (!session) {
      return res.status(400).json({ error: 'Session not found' });
    }
    if ((session.registered || 0) >= session.capacity) {
      return res.status(400).json({ error: 'Session is full — no spots remaining' });
    }

    const [titleDoc, countryDoc, hearAboutDoc] =
      await Promise.all([
        resolveLookupId(Title,     body.titleId),
        resolveLookupId(Country,   body.countryId),
        resolveLookupId(HearAbout, body.hearAboutId),
      ]);

    const qrCodeValue = crypto.randomUUID();
    const qrCodeImage = await generateQR(qrCodeValue);

    const registrant = await VipRegistrant.create({
      organizationId:   org._id,
      eventId:          event._id,
      sessionId:        new mongoose.Types.ObjectId(body.sessionId),
      firstName:        body.firstName.trim(),
      lastName:         body.lastName.trim(),
      email:            body.email.trim().toLowerCase(),
      phone:            body.phone?.trim()    || undefined,
      landline:         body.landline?.trim() || undefined,
      mobile:           body.mobile?.trim()   || undefined,
      gender:           body.gender?.trim()   || undefined,
      country:          countryDoc?.name      || undefined,
      title:            titleDoc?.name        || undefined,
      hearAbout:        hearAboutDoc?.name    || undefined,
      customFields:     collectCustomFields(vipPageConfig?.formFields, body),
      qrCode:           qrCodeValue,
    });

    await Event.findOneAndUpdate(
      { organizationId: org._id, 'sessions._id': body.sessionId },
      { $inc: { 'sessions.$.registered': 1 } }
    );

    const baseUrl = process.env.CLIENT_USER_URL || '';
    sendConfirmationEmail({
      registrant:      registrant.toObject(),
      event:           { name: event.name },
      session:         { name: session.name, date: session.date },
      organization:    { name: org.name },
      emailTemplate,
      qrCodeDataUrl:   qrCodeImage,
      logoUrl:         vipPageConfig?.logoUrl || null,
      confirmationUrl: `${baseUrl}/${org.slug}/vip/confirmation/${registrant._id}`,
    }).catch((emailErr) => {
      console.error('[public] VIP confirmation email failed:', emailErr.message);
    });

    return res.status(201).json({
      success:      true,
      registrantId: registrant._id,
      qrCode:       qrCodeImage,
      badgeType:    'vip',
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        error: 'This email address is already registered as VIP for this event',
      });
    }
    console.error('[public] registerVip error:', err);
    return res.status(500).json({ error: 'VIP registration failed. Please try again.' });
  }
}

module.exports = { getFormConfig, createPaymentIntent, register, getRegistrantDetail, getVipFormConfig, registerVip };
