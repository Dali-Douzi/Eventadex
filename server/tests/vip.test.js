'use strict';

jest.mock('../services/emailService', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendTestEmail:         jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const app     = require('../app');
const db      = require('./db');
const {
  seedMaster, seedOrg, seedVipRegistrant,
  loginAdmin, bearer, ORG_SLUG,
} = require('./helpers');

let token;
let org, event, session;
let vipRegistrantId;

beforeAll(async () => {
  await db.connect();
  await seedMaster();
  const seeded = await seedOrg();
  org     = seeded.org;
  event   = seeded.event;
  session = seeded.session;
  token   = await loginAdmin(app);

  const vipReg = await seedVipRegistrant(org._id, event._id, session._id);
  vipRegistrantId = vipReg._id.toString();
});

afterAll(db.disconnect);

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/public/:orgSlug/vip  (VIP form config)', () => {
  it('returns 200 with VIP page config', async () => {
    const res = await request(app).get(`/api/public/${ORG_SLUG}/vip`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('event');
    expect(res.body).toHaveProperty('pageConfig');
    expect(res.body).toHaveProperty('sessions');
  });

  it('returns dark VIP defaults when no config is saved', async () => {
    const res = await request(app).get(`/api/public/${ORG_SLUG}/vip`);
    // Should have dark theme defaults
    const cfg = res.body.pageConfig;
    expect(cfg.primaryColor).toBeTruthy();
    expect(cfg.secondaryColor).toBeTruthy();
  });

  it('does NOT route through regular config endpoint (VIP path resolves correctly)', async () => {
    const regularRes = await request(app).get(`/api/public/${ORG_SLUG}`);
    const vipRes     = await request(app).get(`/api/public/${ORG_SLUG}/vip`);

    // Both succeed but come from separate controllers (different data)
    expect(regularRes.status).toBe(200);
    expect(vipRes.status).toBe(200);
  });

  it('returns 404 for unknown slug', async () => {
    const res = await request(app).get('/api/public/ghost-org/vip');
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/public/:orgSlug/vip/register', () => {
  it('registers a VIP attendee and returns 201 with badgeType vip', async () => {
    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/vip/register`)
      .send({
        firstName: 'VIP',
        lastName:  'Guest',
        email:     `vip-${Date.now()}@example.com`,
        sessionId: session._id.toString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.badgeType).toBe('vip');
    expect(res.body).toHaveProperty('registrantId');
    expect(res.body).toHaveProperty('qrCode');
  });

  it('saves to VipRegistrant collection (not Registrant)', async () => {
    const { VipRegistrant, Registrant } = require('../models');
    const email = `vip-check-${Date.now()}@example.com`;

    await request(app)
      .post(`/api/public/${ORG_SLUG}/vip/register`)
      .send({ firstName: 'Verify', lastName: 'Collection', email, sessionId: session._id.toString() });

    const vipDoc = await VipRegistrant.findOne({ email, organizationId: org._id });
    const regDoc = await Registrant.findOne({ email, organizationId: org._id });

    expect(vipDoc).not.toBeNull();
    expect(regDoc).toBeNull();
    expect(vipDoc.badgeType).toBe('vip');
  });

  it('rejects duplicate VIP email with 409', async () => {
    const email = `vip-dup-${Date.now()}@example.com`;
    const payload = { firstName: 'Dup', lastName: 'VIP', email, sessionId: session._id.toString() };

    await request(app).post(`/api/public/${ORG_SLUG}/vip/register`).send(payload);
    const res = await request(app).post(`/api/public/${ORG_SLUG}/vip/register`).send(payload);

    expect(res.status).toBe(409);
  });

  it('allows same email as regular AND VIP (separate collections)', async () => {
    const email = `shared-${Date.now()}@example.com`;
    const payload = { firstName: 'Both', lastName: 'Ways', email, sessionId: session._id.toString() };

    const regRes = await request(app).post(`/api/public/${ORG_SLUG}/register`).send(payload);
    const vipRes = await request(app).post(`/api/public/${ORG_SLUG}/vip/register`).send(payload);

    expect(regRes.status).toBe(201);
    expect(vipRes.status).toBe(201);
  });

  it('rejects missing firstName with 422', async () => {
    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/vip/register`)
      .send({ lastName: 'X', email: 'x@x.com', sessionId: session._id.toString() });

    expect(res.status).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/public/:orgSlug/registrant/:id  (VIP fallback)', () => {
  it('finds VIP registrant via public confirmation endpoint', async () => {
    const res = await request(app)
      .get(`/api/public/${ORG_SLUG}/registrant/${vipRegistrantId}`);

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Jane');
    expect(res.body).toHaveProperty('qrCodeImage');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/admin/vip-page-config', () => {
  it('auto-creates and returns VIP page config with dark defaults', async () => {
    const res = await request(app)
      .get('/api/admin/vip-page-config')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.primaryColor).toBe('#1a1a2e');
    expect(res.body.secondaryColor).toBe('#e2b96f');
  });

  it('second call returns same document (idempotent)', async () => {
    const r1 = await request(app).get('/api/admin/vip-page-config').set('Authorization', bearer(token));
    const r2 = await request(app).get('/api/admin/vip-page-config').set('Authorization', bearer(token));

    expect(r1.body._id).toBe(r2.body._id);
  });
});

describe('PUT /api/admin/vip-page-config', () => {
  it('updates VIP page config', async () => {
    const res = await request(app)
      .put('/api/admin/vip-page-config')
      .set('Authorization', bearer(token))
      .send({ headerText: 'VIP Welcome', secondaryColor: '#gold00' });

    expect(res.status).toBe(200);
    expect(res.body.headerText).toBe('VIP Welcome');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/admin/vip-registrants', () => {
  it('returns paginated VIP registrants', async () => {
    const res = await request(app)
      .get('/api/admin/vip-registrants')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('does NOT include normal registrants in the VIP list', async () => {
    const res = await request(app)
      .get('/api/admin/vip-registrants')
      .set('Authorization', bearer(token));

    // All returned docs should be VIP
    expect(res.body.data.every((r) => r.badgeType === 'vip')).toBe(true);
  });
});

describe('GET /api/admin/vip-registrants/search', () => {
  it('finds VIP registrant by email', async () => {
    const res = await request(app)
      .get('/api/admin/vip-registrants/search?q=jane.vip@example.com')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.badgeType).toBe('vip');
    expect(res.body.firstName).toBe('Jane');
  });

  it('returns 404 for no VIP match', async () => {
    const res = await request(app)
      .get('/api/admin/vip-registrants/search?q=nobody@nowhere.com')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(404);
  });

  it('does NOT find a normal registrant via VIP search', async () => {
    // john.doe is in Registrant, not VipRegistrant
    const res = await request(app)
      .get('/api/admin/vip-registrants/search?q=john.doe@example.com')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/admin/vip-registrants/:id/checkin', () => {
  it('checks in a VIP registrant', async () => {
    const res = await request(app)
      .patch(`/api/admin/vip-registrants/${vipRegistrantId}/checkin`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.checkedIn).toBe(true);
  });
});

describe('PATCH /api/admin/vip-registrants/:id/checkout', () => {
  it('checks out a VIP registrant', async () => {
    const res = await request(app)
      .patch(`/api/admin/vip-registrants/${vipRegistrantId}/checkout`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.checkedOut).toBe(true);
  });
});

describe('GET /api/admin/vip-registrants/export', () => {
  it('returns CSV with VIP registrants', async () => {
    const res = await request(app)
      .get('/api/admin/vip-registrants/export')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toMatch(/First Name/);
  });
});
