'use strict';

/**
 * Shared test helpers — seeds data and provides convenience login functions.
 */

const request = require('supertest');
const bcrypt  = require('bcryptjs');
const mongoose = require('mongoose');
const {
  MasterUser, Organization, Event, PageConfig,
  EmailTemplate, Registrant, VipRegistrant, VipPageConfig,
} = require('../models');

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MASTER_CREDS = { email: 'master@test.com', password: 'masterpass123' };
const ADMIN_CREDS  = { email: 'admin@testorg.com', password: 'adminpass123' };
const ORG_SLUG     = 'test-org';

// ─── Seeders ─────────────────────────────────────────────────────────────────

async function seedMaster() {
  const hashed = await bcrypt.hash(MASTER_CREDS.password, 4);
  return MasterUser.create({
    name:     'Test Master',
    email:    MASTER_CREDS.email,
    password: hashed,
  });
}

/**
 * Seeds an org with a published event that has one session.
 * Returns { org, event, session }.
 */
async function seedOrg() {
  const hashed = await bcrypt.hash(ADMIN_CREDS.password, 4);

  const org = await Organization.create({
    name:     'Test Org',
    email:    ADMIN_CREDS.email,
    password: hashed,
    slug:     ORG_SLUG,
    status:   'active',
  });

  const event = await Event.create({
    organizationId: org._id,
    name:           'Test Event 2026',
    description:    'A test event',
    startDate:      new Date('2026-06-01'),
    endDate:        new Date('2026-06-02'),
    status:         'published',
    paymentEnabled: false,
    sessions:       [
      { name: 'Morning Session', date: new Date('2026-06-01'), capacity: 50, registered: 0 },
      { name: 'Afternoon Session', date: new Date('2026-06-01'), capacity: 2, registered: 0 },
    ],
  });

  await Organization.findByIdAndUpdate(org._id, { eventId: event._id });

  await PageConfig.create({
    organizationId: org._id,
    primaryColor:   '#2563eb',
    secondaryColor: '#64748b',
    headerText:     'Welcome to Test Org',
    formFields: [
      { fieldName: 'firstName', label: 'First Name', type: 'text',  required: true,  visible: true },
      { fieldName: 'lastName',  label: 'Last Name',  type: 'text',  required: true,  visible: true },
      { fieldName: 'email',     label: 'Email',      type: 'email', required: true,  visible: true },
      { fieldName: 'phone',     label: 'Phone',      type: 'phone', required: false, visible: true },
    ],
  });

  await EmailTemplate.create({
    organizationId: org._id,
    subject:        'Your Registration Confirmation',
    body:           'Hello {{firstName}}, you are registered!',
  });

  const freshEvent = await Event.findById(event._id);
  const session = freshEvent.sessions[0];

  return { org, event: freshEvent, session };
}

/**
 * Seeds a registrant in the normal Registrant collection.
 */
async function seedRegistrant(orgId, eventId, sessionId, overrides = {}) {
  return Registrant.create({
    organizationId: orgId,
    eventId,
    sessionId,
    firstName:      'John',
    lastName:       'Doe',
    email:          'john.doe@example.com',
    qrCode:         'test-qr-' + Date.now() + '-' + Math.random().toString(36).slice(2),
    ...overrides,
  });
}

/**
 * Seeds a VIP registrant.
 */
async function seedVipRegistrant(orgId, eventId, sessionId, overrides = {}) {
  return VipRegistrant.create({
    organizationId: orgId,
    eventId,
    sessionId,
    firstName:      'Jane',
    lastName:       'VIP',
    email:          'jane.vip@example.com',
    qrCode:         'vip-qr-' + Date.now() + '-' + Math.random().toString(36).slice(2),
    badgeType:      'vip',
    ...overrides,
  });
}

// ─── Login helpers ────────────────────────────────────────────────────────────

async function loginMaster(app) {
  const res = await request(app)
    .post('/api/auth/master/login')
    .send(MASTER_CREDS);
  if (!res.body.token) throw new Error('Master login failed: ' + JSON.stringify(res.body));
  return res.body.token;
}

async function loginAdmin(app) {
  const res = await request(app)
    .post('/api/auth/admin/login')
    .send(ADMIN_CREDS);
  if (!res.body.token) throw new Error('Admin login failed: ' + JSON.stringify(res.body));
  return res.body.token;
}

// ─── Auth header helper ───────────────────────────────────────────────────────

function bearer(token) {
  return `Bearer ${token}`;
}

module.exports = {
  MASTER_CREDS,
  ADMIN_CREDS,
  ORG_SLUG,
  seedMaster,
  seedOrg,
  seedRegistrant,
  seedVipRegistrant,
  loginMaster,
  loginAdmin,
  bearer,
};
