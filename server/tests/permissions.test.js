'use strict';

/**
 * Tests for:
 *  - PATCH /api/master/organizations/:id/permissions
 *  - Per-permission enforcement (canExportData, canCheckIn, canViewVip)
 *  - Cross-role token rejection (admin token on master routes, vice versa)
 */

jest.mock('../services/emailService', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendTestEmail:         jest.fn().mockResolvedValue(undefined),
}));

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../app');
const db       = require('./db');
const {
  seedMaster, seedOrg, seedRegistrant, seedVipRegistrant,
  loginMaster, loginAdmin, bearer,
} = require('./helpers');

let masterToken;
let adminToken;
let org, event, session;
let registrantId, vipRegistrantId;

beforeAll(async () => {
  await db.connect();
  await seedMaster();
  const seeded = await seedOrg();
  org     = seeded.org;
  event   = seeded.event;
  session = seeded.session;

  masterToken = await loginMaster(app);
  adminToken  = await loginAdmin(app);

  const r  = await seedRegistrant(org._id, event._id, session._id);
  const vr = await seedVipRegistrant(org._id, event._id, session._id);
  registrantId    = r._id.toString();
  vipRegistrantId = vr._id.toString();
});

afterAll(db.disconnect);

// ─── PATCH permissions ────────────────────────────────────────────────────────

describe('PATCH /api/master/organizations/:id/permissions', () => {
  it('can disable canExportData', async () => {
    const res = await request(app)
      .patch(`/api/master/organizations/${org._id}/permissions`)
      .set('Authorization', bearer(masterToken))
      .send({ canExportData: false });

    expect(res.status).toBe(200);
    expect(res.body.permissions.canExportData).toBe(false);

    // Restore
    await request(app)
      .patch(`/api/master/organizations/${org._id}/permissions`)
      .set('Authorization', bearer(masterToken))
      .send({ canExportData: true });
  });

  it('can disable multiple permissions in one call', async () => {
    const res = await request(app)
      .patch(`/api/master/organizations/${org._id}/permissions`)
      .set('Authorization', bearer(masterToken))
      .send({ canCheckIn: false, canViewVip: false });

    expect(res.status).toBe(200);
    expect(res.body.permissions.canCheckIn).toBe(false);
    expect(res.body.permissions.canViewVip).toBe(false);

    // Restore
    await request(app)
      .patch(`/api/master/organizations/${org._id}/permissions`)
      .set('Authorization', bearer(masterToken))
      .send({ canCheckIn: true, canViewVip: true });
  });

  it('re-enabling a permission works correctly', async () => {
    await request(app)
      .patch(`/api/master/organizations/${org._id}/permissions`)
      .set('Authorization', bearer(masterToken))
      .send({ canExportData: false });

    const res = await request(app)
      .patch(`/api/master/organizations/${org._id}/permissions`)
      .set('Authorization', bearer(masterToken))
      .send({ canExportData: true });

    expect(res.status).toBe(200);
    expect(res.body.permissions.canExportData).toBe(true);
  });

  it('returns 404 for an unknown org ID', async () => {
    const res = await request(app)
      .patch(`/api/master/organizations/${new mongoose.Types.ObjectId()}/permissions`)
      .set('Authorization', bearer(masterToken))
      .send({ canExportData: false });

    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .patch(`/api/master/organizations/${org._id}/permissions`)
      .send({ canExportData: false });

    expect(res.status).toBe(401);
  });
});

// ─── canExportData enforcement ────────────────────────────────────────────────

describe('Permission enforcement: canExportData = false', () => {
  beforeAll(async () => {
    await request(app)
      .patch(`/api/master/organizations/${org._id}/permissions`)
      .set('Authorization', bearer(masterToken))
      .send({ canExportData: false });
  });

  afterAll(async () => {
    await request(app)
      .patch(`/api/master/organizations/${org._id}/permissions`)
      .set('Authorization', bearer(masterToken))
      .send({ canExportData: true });
  });

  it('GET /api/admin/registrants/export returns 403', async () => {
    const res = await request(app)
      .get('/api/admin/registrants/export')
      .set('Authorization', bearer(adminToken));

    expect(res.status).toBe(403);
  });

  it('GET /api/admin/vip-registrants/export returns 403', async () => {
    const res = await request(app)
      .get('/api/admin/vip-registrants/export')
      .set('Authorization', bearer(adminToken));

    expect(res.status).toBe(403);
  });

  it('registrant list (non-export) still returns 200', async () => {
    const res = await request(app)
      .get('/api/admin/registrants')
      .set('Authorization', bearer(adminToken));

    expect(res.status).toBe(200);
  });
});

// ─── canCheckIn enforcement ───────────────────────────────────────────────────

describe('Permission enforcement: canCheckIn = false', () => {
  beforeAll(async () => {
    await request(app)
      .patch(`/api/master/organizations/${org._id}/permissions`)
      .set('Authorization', bearer(masterToken))
      .send({ canCheckIn: false });
  });

  afterAll(async () => {
    await request(app)
      .patch(`/api/master/organizations/${org._id}/permissions`)
      .set('Authorization', bearer(masterToken))
      .send({ canCheckIn: true });
  });

  it('PATCH registrant checkin returns 403', async () => {
    const res = await request(app)
      .patch(`/api/admin/registrants/${registrantId}/checkin`)
      .set('Authorization', bearer(adminToken));

    expect(res.status).toBe(403);
  });

  it('PATCH registrant checkout returns 403', async () => {
    const res = await request(app)
      .patch(`/api/admin/registrants/${registrantId}/checkout`)
      .set('Authorization', bearer(adminToken));

    expect(res.status).toBe(403);
  });

  it('PATCH VIP registrant checkin returns 403', async () => {
    const res = await request(app)
      .patch(`/api/admin/vip-registrants/${vipRegistrantId}/checkin`)
      .set('Authorization', bearer(adminToken));

    expect(res.status).toBe(403);
  });

  it('PATCH VIP registrant checkout returns 403', async () => {
    const res = await request(app)
      .patch(`/api/admin/vip-registrants/${vipRegistrantId}/checkout`)
      .set('Authorization', bearer(adminToken));

    expect(res.status).toBe(403);
  });

  it('non-checkin endpoints (list, search) still return 200', async () => {
    const res = await request(app)
      .get('/api/admin/registrants')
      .set('Authorization', bearer(adminToken));

    expect(res.status).toBe(200);
  });
});

// ─── canViewVip enforcement ───────────────────────────────────────────────────

describe('Permission enforcement: canViewVip = false', () => {
  beforeAll(async () => {
    await request(app)
      .patch(`/api/master/organizations/${org._id}/permissions`)
      .set('Authorization', bearer(masterToken))
      .send({ canViewVip: false });
  });

  afterAll(async () => {
    await request(app)
      .patch(`/api/master/organizations/${org._id}/permissions`)
      .set('Authorization', bearer(masterToken))
      .send({ canViewVip: true });
  });

  it('GET /api/admin/vip-registrants returns 403', async () => {
    const res = await request(app)
      .get('/api/admin/vip-registrants')
      .set('Authorization', bearer(adminToken));

    expect(res.status).toBe(403);
  });

  it('GET /api/admin/vip-registrants/search returns 403', async () => {
    const res = await request(app)
      .get('/api/admin/vip-registrants/search?q=anyone@example.com')
      .set('Authorization', bearer(adminToken));

    expect(res.status).toBe(403);
  });

  it('GET /api/admin/vip-registrants/export returns 403', async () => {
    const res = await request(app)
      .get('/api/admin/vip-registrants/export')
      .set('Authorization', bearer(adminToken));

    // Requires both canViewVip AND canExportData — canViewVip check fires first
    expect(res.status).toBe(403);
  });

  it('normal registrant list is unaffected by canViewVip', async () => {
    const res = await request(app)
      .get('/api/admin/registrants')
      .set('Authorization', bearer(adminToken));

    expect(res.status).toBe(200);
  });
});

// ─── Cross-role token rejection ───────────────────────────────────────────────

describe('Cross-role token enforcement', () => {
  it('admin token is rejected on GET /api/master/stats with 403', async () => {
    const res = await request(app)
      .get('/api/master/stats')
      .set('Authorization', bearer(adminToken));

    expect(res.status).toBe(403);
  });

  it('admin token is rejected on GET /api/master/organizations with 403', async () => {
    const res = await request(app)
      .get('/api/master/organizations')
      .set('Authorization', bearer(adminToken));

    expect(res.status).toBe(403);
  });

  it('master token is rejected on GET /api/admin/event with 403', async () => {
    const res = await request(app)
      .get('/api/admin/event')
      .set('Authorization', bearer(masterToken));

    expect(res.status).toBe(403);
  });

  it('master token is rejected on GET /api/admin/registrants with 403', async () => {
    const res = await request(app)
      .get('/api/admin/registrants')
      .set('Authorization', bearer(masterToken));

    expect(res.status).toBe(403);
  });

  it('master token is rejected on PATCH /api/admin/event with 403', async () => {
    const res = await request(app)
      .patch('/api/admin/event')
      .set('Authorization', bearer(masterToken))
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });
});
