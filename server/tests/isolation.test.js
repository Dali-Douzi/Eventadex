'use strict';

/**
 * Multi-org data isolation tests.
 * Verifies that Org A's admin cannot see, search, check in, or export
 * Org B's registrants, and vice versa.
 */

jest.mock('../services/emailService', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendTestEmail:         jest.fn().mockResolvedValue(undefined),
}));

const request  = require('supertest');
const bcrypt   = require('bcryptjs');
const app      = require('../app');
const db       = require('./db');
const {
  Organization, Event, PageConfig, EmailTemplate,
} = require('../models');
const {
  seedMaster, seedOrg, seedRegistrant,
  loginAdmin, bearer, ORG_SLUG,
} = require('./helpers');

// ── Org B fixtures ────────────────────────────────────────────────────────────

const ORG_B_CREDS = { email: 'admin@orgb.com', password: 'orgbpass123' };
const ORG_B_SLUG  = 'org-b';

async function seedOrgB() {
  const hashed = await bcrypt.hash(ORG_B_CREDS.password, 4);
  const org = await Organization.create({
    name:     'Org B',
    email:    ORG_B_CREDS.email,
    password: hashed,
    slug:     ORG_B_SLUG,
    status:   'active',
  });
  const event = await Event.create({
    organizationId: org._id,
    name:           'Org B Event',
    startDate:      new Date('2026-07-01'),
    endDate:        new Date('2026-07-02'),
    status:         'published',
    sessions: [{ name: 'Org B Session', date: new Date('2026-07-01'), capacity: 50 }],
  });
  await Organization.findByIdAndUpdate(org._id, { eventId: event._id });
  await PageConfig.create({ organizationId: org._id });
  await EmailTemplate.create({ organizationId: org._id, subject: 'Org B Confirmation' });

  const freshEvent = await Event.findById(event._id);
  return { org, event: freshEvent, session: freshEvent.sessions[0] };
}

// ── Test state ─────────────────────────────────────────────────────────────────

let tokenA, tokenB;
let orgA, eventA, sessionA;
let orgB, eventB, sessionB;
let registrantA, registrantB;

beforeAll(async () => {
  await db.connect();
  await seedMaster();

  const seededA = await seedOrg();
  orgA     = seededA.org;
  eventA   = seededA.event;
  sessionA = seededA.session;
  tokenA   = await loginAdmin(app);

  const seededB = await seedOrgB();
  orgB     = seededB.org;
  eventB   = seededB.event;
  sessionB = seededB.session;

  const loginB = await request(app).post('/api/auth/admin/login').send(ORG_B_CREDS);
  tokenB = loginB.body.token;

  registrantA = await seedRegistrant(orgA._id, eventA._id, sessionA._id, {
    email: 'registrant-a@example.com',
  });
  registrantB = await seedRegistrant(orgB._id, eventB._id, sessionB._id, {
    email: 'registrant-b@example.com',
  });
});

afterAll(db.disconnect);

// ─── Registrant list isolation ────────────────────────────────────────────────

describe('Registrant list isolation', () => {
  it("Org A admin does not see Org B's registrants", async () => {
    const res = await request(app)
      .get('/api/admin/registrants')
      .set('Authorization', bearer(tokenA));

    expect(res.status).toBe(200);
    const emails = res.body.data.map((r) => r.email);
    expect(emails).not.toContain('registrant-b@example.com');
    expect(emails).toContain('registrant-a@example.com');
  });

  it("Org B admin does not see Org A's registrants", async () => {
    const res = await request(app)
      .get('/api/admin/registrants')
      .set('Authorization', bearer(tokenB));

    expect(res.status).toBe(200);
    const emails = res.body.data.map((r) => r.email);
    expect(emails).not.toContain('registrant-a@example.com');
    expect(emails).toContain('registrant-b@example.com');
  });

  it('each org sees only its own total count in dashboard stats', async () => {
    const resA = await request(app).get('/api/admin/stats').set('Authorization', bearer(tokenA));
    const resB = await request(app).get('/api/admin/stats').set('Authorization', bearer(tokenB));

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.body.totalRegistrants).toBe(1);
    expect(resB.body.totalRegistrants).toBe(1);
  });
});

// ─── Search isolation ─────────────────────────────────────────────────────────

describe('Registrant search isolation', () => {
  it("Org A admin cannot find Org B's registrant by email", async () => {
    const res = await request(app)
      .get('/api/admin/registrants/search?q=registrant-b@example.com')
      .set('Authorization', bearer(tokenA));

    expect(res.status).toBe(404);
  });

  it("Org B admin cannot find Org A's registrant by email", async () => {
    const res = await request(app)
      .get('/api/admin/registrants/search?q=registrant-a@example.com')
      .set('Authorization', bearer(tokenB));

    expect(res.status).toBe(404);
  });

  it("Org A admin cannot find Org B's registrant by QR code", async () => {
    const res = await request(app)
      .get(`/api/admin/registrants/search?q=${registrantB.qrCode}`)
      .set('Authorization', bearer(tokenA));

    expect(res.status).toBe(404);
  });
});

// ─── Single registrant isolation ──────────────────────────────────────────────

describe('Single registrant fetch isolation', () => {
  it("Org B admin cannot fetch Org A's registrant by ID", async () => {
    const res = await request(app)
      .get(`/api/admin/registrants/${registrantA._id}`)
      .set('Authorization', bearer(tokenB));

    expect(res.status).toBe(404);
  });

  it("Org A admin cannot fetch Org B's registrant by ID", async () => {
    const res = await request(app)
      .get(`/api/admin/registrants/${registrantB._id}`)
      .set('Authorization', bearer(tokenA));

    expect(res.status).toBe(404);
  });
});

// ─── Check-in isolation ───────────────────────────────────────────────────────

describe('Check-in isolation', () => {
  it("Org B admin cannot check in Org A's registrant", async () => {
    const res = await request(app)
      .patch(`/api/admin/registrants/${registrantA._id}/checkin`)
      .set('Authorization', bearer(tokenB));

    expect(res.status).toBe(404);
  });

  it("Org A admin cannot check in Org B's registrant", async () => {
    const res = await request(app)
      .patch(`/api/admin/registrants/${registrantB._id}/checkin`)
      .set('Authorization', bearer(tokenA));

    expect(res.status).toBe(404);
  });
});

// ─── Export isolation ─────────────────────────────────────────────────────────

describe('CSV export isolation', () => {
  it("Org A export contains Org A registrant and not Org B registrant", async () => {
    const res = await request(app)
      .get('/api/admin/registrants/export')
      .set('Authorization', bearer(tokenA));

    expect(res.status).toBe(200);
    expect(res.text).toContain('registrant-a@example.com');
    expect(res.text).not.toContain('registrant-b@example.com');
  });

  it("Org B export contains Org B registrant and not Org A registrant", async () => {
    const res = await request(app)
      .get('/api/admin/registrants/export')
      .set('Authorization', bearer(tokenB));

    expect(res.status).toBe(200);
    expect(res.text).toContain('registrant-b@example.com');
    expect(res.text).not.toContain('registrant-a@example.com');
  });
});

// ─── Event isolation ──────────────────────────────────────────────────────────

describe('Event and page config isolation', () => {
  it("Org A admin sees Org A's event only", async () => {
    const res = await request(app)
      .get('/api/admin/event')
      .set('Authorization', bearer(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Event 2026');
  });

  it("Org B admin sees Org B's event only", async () => {
    const res = await request(app)
      .get('/api/admin/event')
      .set('Authorization', bearer(tokenB));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Org B Event');
  });
});

// ─── Public endpoint isolation ────────────────────────────────────────────────

describe('Public registration endpoint isolation', () => {
  it("Org A's public form is served at Org A's slug", async () => {
    const res = await request(app).get(`/api/public/${ORG_SLUG}`);
    expect(res.status).toBe(200);
    expect(res.body.event.name).toBe('Test Event 2026');
  });

  it("Org B's public form is served at Org B's slug", async () => {
    const res = await request(app).get(`/api/public/${ORG_B_SLUG}`);
    expect(res.status).toBe(200);
    expect(res.body.event.name).toBe('Org B Event');
  });

  it("Registering on Org A does not increment Org B's session counter", async () => {
    const beforeRes = await request(app).get(`/api/public/${ORG_B_SLUG}`);
    const countBefore = beforeRes.body.sessions[0].registered;

    await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'Cross',
        lastName:  'OrgTest',
        email:     `crossorg-${Date.now()}@example.com`,
        sessionId: sessionA._id.toString(),
      });

    const afterRes = await request(app).get(`/api/public/${ORG_B_SLUG}`);
    const countAfter = afterRes.body.sessions[0].registered;

    expect(countAfter).toBe(countBefore);
  });
});
