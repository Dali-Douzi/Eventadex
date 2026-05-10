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
  Title, Country, SponsorType, HearAbout, RegisterInterest,
} = require('../models');

const { sendConfirmationEmail } = require('../services/emailService');

// Fields handled explicitly — anything else in formFields is a "custom" field
const STANDARD_FIELD_NAMES = new Set([
  'firstName', 'lastName', 'email', 'phone', 'landline', 'mobile',
  'gender', 'country', 'title', 'hearAbout', 'registerInterest',
  'sponsorType', 'sessionId', 'paymentIntentId',
]);

// ─── Lazy Stripe initialisation ───────────────────────────────────────────────
//
// Stripe is only imported when the first payment endpoint is hit so the server
// starts normally even when STRIPE_SECRET_KEY is not configured (free-only events).

let _stripe = null;
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured in .env');
    }
    // eslint-disable-next-line global-require
    _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
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
      titles, countries, hearAbout, registerInterest, sponsorTypes,
    ] = await Promise.all([
      PageConfig.findOne({ organizationId: org._id }),
      loadLookup(Title,            org._id),
      loadLookup(Country,          org._id),
      loadLookup(HearAbout,        org._id),
      loadLookup(RegisterInterest, org._id),
      loadLookup(SponsorType,      org._id),
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
        registerInterest,
        sponsorTypes,
      },
    });
  } catch (err) {
    console.error('[public] getFormConfig error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── 2. POST /api/public/:orgSlug/create-payment-intent ──────────────────────

async function createPaymentIntent(req, res) {
  try {
    const org = await findActiveOrg(req.params.orgSlug);
    if (!org) {
      return res.status(404).json({ error: 'Registration not found or not available' });
    }

    const event = await findPublishedEvent(org._id);
    if (!event) {
      return res.status(404).json({ error: 'Registration not found or not available' });
    }
    if (!event.paymentEnabled) {
      return res.status(400).json({ error: 'Payments are not enabled for this event' });
    }
    if (!event.ticketPrice || event.ticketPrice <= 0) {
      return res.status(400).json({ error: 'Invalid ticket price configured' });
    }

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount:   Math.round(event.ticketPrice * 100), // convert to smallest currency unit
      currency: (event.currency || 'USD').toLowerCase(),
      metadata: {
        orgId:   org._id.toString(),
        eventId: event._id.toString(),
      },
      automatic_payment_methods: { enabled: true },
    });

    return res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error('[public] createPaymentIntent error:', err);
    // Surface Stripe-specific errors with a friendlier message
    if (err.type === 'StripeAuthenticationError') {
      return res.status(500).json({ error: 'Payment service is misconfigured. Please contact support.' });
    }
    if (err.type === 'StripeConnectionError' || err.code === 'ENOTFOUND') {
      return res.status(503).json({ error: 'Could not reach the payment provider. Please try again.' });
    }
    if (err.type) {
      // Any other Stripe error (StripeCardError, StripeRateLimitError, StripeInvalidRequestError …)
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Could not create payment session. Please try again.' });
  }
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

    // ── Payment verification ───────────────────────────────────
    let paymentStatus = 'free';
    if (event.paymentEnabled) {
      if (!body.paymentIntentId) {
        return res.status(400).json({ error: 'Payment is required for this event' });
      }

      const stripe = getStripe();
      let intent;
      try {
        intent = await stripe.paymentIntents.retrieve(body.paymentIntentId);
      } catch (stripeErr) {
        console.error('[public] Stripe retrieve error:', stripeErr.message);
        return res.status(400).json({ error: 'Could not verify payment. Please try again.' });
      }

      // 1. Status must be succeeded
      if (intent.status !== 'succeeded') {
        return res.status(400).json({
          error: `Payment has not been confirmed (Stripe status: ${intent.status})`,
        });
      }

      // 2. Amount must match the configured ticket price — prevents price manipulation
      const expectedCents = Math.round(event.ticketPrice * 100);
      if (intent.amount !== expectedCents) {
        console.warn(
          `[public] Payment amount mismatch for org ${org._id}: ` +
          `expected ${expectedCents} cents, got ${intent.amount} cents`
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
    const [titleDoc, countryDoc, hearAboutDoc, regInterestDoc, sponsorDoc] =
      await Promise.all([
        resolveLookupId(Title,            body.titleId),
        resolveLookupId(Country,          body.countryId),
        resolveLookupId(HearAbout,        body.hearAboutId),
        resolveLookupId(RegisterInterest, body.registerInterestId),
        resolveLookupId(SponsorType,      body.sponsorTypeId),
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
      registerInterest: regInterestDoc?.name  || undefined,
      sponsorType:      sponsorDoc?.name      || undefined,
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
    sendConfirmationEmail({
      registrant:    registrant.toObject(),
      event:         { name: event.name },
      session:       { name: session.name, date: session.date },
      organization:  { name: org.name },
      emailTemplate,
      qrCodeDataUrl: qrCodeImage,
      logoUrl:       pageConfig?.logoUrl || null,
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
      titles, countries, hearAbout, registerInterest, sponsorTypes,
    ] = await Promise.all([
      VipPageConfig.findOne({ organizationId: org._id }),
      loadLookup(Title,            org._id),
      loadLookup(Country,          org._id),
      loadLookup(HearAbout,        org._id),
      loadLookup(RegisterInterest, org._id),
      loadLookup(SponsorType,      org._id),
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
      lookups: { titles, countries, hearAbout, registerInterest, sponsorTypes },
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

    const [titleDoc, countryDoc, hearAboutDoc, regInterestDoc, sponsorDoc] =
      await Promise.all([
        resolveLookupId(Title,            body.titleId),
        resolveLookupId(Country,          body.countryId),
        resolveLookupId(HearAbout,        body.hearAboutId),
        resolveLookupId(RegisterInterest, body.registerInterestId),
        resolveLookupId(SponsorType,      body.sponsorTypeId),
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
      registerInterest: regInterestDoc?.name  || undefined,
      sponsorType:      sponsorDoc?.name      || undefined,
      customFields:     collectCustomFields(vipPageConfig?.formFields, body),
      qrCode:           qrCodeValue,
    });

    await Event.findOneAndUpdate(
      { organizationId: org._id, 'sessions._id': body.sessionId },
      { $inc: { 'sessions.$.registered': 1 } }
    );

    sendConfirmationEmail({
      registrant:    registrant.toObject(),
      event:         { name: event.name },
      session:       { name: session.name, date: session.date },
      organization:  { name: org.name },
      emailTemplate,
      qrCodeDataUrl: qrCodeImage,
      logoUrl:       vipPageConfig?.logoUrl || null,
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
