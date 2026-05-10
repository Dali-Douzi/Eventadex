'use strict';

const request = require('supertest');
const app     = require('../app');
const db      = require('./db');
const { seedMaster, seedOrg, MASTER_CREDS } = require('./helpers');

let token;
let orgId;

function bearer(t) { return `Bearer ${t}`; }

async function loginMaster() {
  const res = await request(app).post('/api/auth/master/login').send(MASTER_CREDS);
  if (!res.body.token) throw new Error('Master login failed: ' + JSON.stringify(res.body));
  return res.body.token;
}

beforeAll(async () => {
  await db.connect();
  await seedMaster();
  const seeded = await seedOrg();
  orgId = seeded.org._id.toString();
  token = await loginMaster();
});

afterAll(db.disconnect);

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth guard — master routes reject non-master tokens', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/master/stats');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/master/stats', () => {
  it('returns platform stats', async () => {
    const res = await request(app)
      .get('/api/master/stats')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalOrgs');
    expect(res.body).toHaveProperty('activeOrgs');
    expect(res.body).toHaveProperty('totalRegistrants');
    expect(res.body).toHaveProperty('totalEvents');
    expect(typeof res.body.totalOrgs).toBe('number');
    expect(res.body.activeOrgs).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/master/organizations', () => {
  it('returns paginated organizations', async () => {
    const res = await request(app)
      .get('/api/master/organizations')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('filters by search query', async () => {
    const res = await request(app)
      .get('/api/master/organizations?search=Test Org')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toMatch(/test org/i);
  });

  it('filters by status', async () => {
    const res = await request(app)
      .get('/api/master/organizations?status=active')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.every((o) => o.status === 'active')).toBe(true);
  });

  it('does not return password field', async () => {
    const res = await request(app)
      .get('/api/master/organizations')
      .set('Authorization', bearer(token));

    expect(res.body.data.every((o) => !o.password)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/master/organizations', () => {
  it('creates a new organization with linked event and page config', async () => {
    const res = await request(app)
      .post('/api/master/organizations')
      .set('Authorization', bearer(token))
      .send({ name: 'New Corp', email: `newcorp-${Date.now()}@example.com`, password: 'securepass123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('_id');
    expect(res.body).toHaveProperty('slug');
    expect(res.body).not.toHaveProperty('password');
  });

  it('rejects duplicate email with 409', async () => {
    const email = `dup-master-${Date.now()}@example.com`;
    await request(app)
      .post('/api/master/organizations')
      .set('Authorization', bearer(token))
      .send({ name: 'Dup A', email, password: 'pass123' });

    const res = await request(app)
      .post('/api/master/organizations')
      .set('Authorization', bearer(token))
      .send({ name: 'Dup B', email, password: 'pass123' });

    expect(res.status).toBe(409);
  });

  it('rejects missing fields with 400', async () => {
    const res = await request(app)
      .post('/api/master/organizations')
      .set('Authorization', bearer(token))
      .send({ name: 'No Email' });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/master/organizations/:id', () => {
  it('returns a single organization', async () => {
    const res = await request(app)
      .get(`/api/master/organizations/${orgId}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body._id.toString()).toBe(orgId);
    expect(res.body).not.toHaveProperty('password');
  });

  it('returns 404 for unknown ID', async () => {
    const { Types } = require('mongoose');
    const res = await request(app)
      .get(`/api/master/organizations/${new Types.ObjectId()}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/master/organizations/:id', () => {
  it('updates organization name', async () => {
    const res = await request(app)
      .patch(`/api/master/organizations/${orgId}`)
      .set('Authorization', bearer(token))
      .send({ name: 'Updated Org Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Org Name');
  });

  it('updates organization status', async () => {
    const res = await request(app)
      .patch(`/api/master/organizations/${orgId}`)
      .set('Authorization', bearer(token))
      .send({ status: 'suspended' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('suspended');

    // Restore
    await request(app)
      .patch(`/api/master/organizations/${orgId}`)
      .set('Authorization', bearer(token))
      .send({ status: 'active' });
  });

  it('rejects duplicate slug with 409', async () => {
    // Create a second org first
    const createRes = await request(app)
      .post('/api/master/organizations')
      .set('Authorization', bearer(token))
      .send({ name: 'Slug Clash Org', email: `slugclash-${Date.now()}@example.com`, password: 'pass123' });

    const secondOrgId = createRes.body._id;

    // Try to set its slug to the first org's slug
    const res = await request(app)
      .patch(`/api/master/organizations/${secondOrgId}`)
      .set('Authorization', bearer(token))
      .send({ slug: 'test-org' });

    expect(res.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/master/organizations/:id/reset-password', () => {
  it('resets the org password', async () => {
    const res = await request(app)
      .patch(`/api/master/organizations/${orgId}/reset-password`)
      .set('Authorization', bearer(token))
      .send({ password: 'newSecurePass456' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .patch(`/api/master/organizations/${orgId}/reset-password`)
      .set('Authorization', bearer(token))
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /api/master/organizations/:id', () => {
  it('soft-deletes an organization (sets status to deleted)', async () => {
    // Create a throwaway org to delete
    const createRes = await request(app)
      .post('/api/master/organizations')
      .set('Authorization', bearer(token))
      .send({ name: 'To Delete', email: `delete-${Date.now()}@example.com`, password: 'pass123' });

    const deleteId = createRes.body._id;

    const res = await request(app)
      .delete(`/api/master/organizations/${deleteId}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.org.status).toBe('deleted');
  });

  it('returns 404 for unknown ID', async () => {
    const { Types } = require('mongoose');
    const res = await request(app)
      .delete(`/api/master/organizations/${new Types.ObjectId()}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/master/lookups/:type', () => {
  it('returns empty array for valid lookup type', async () => {
    const res = await request(app)
      .get('/api/master/lookups/title')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 400 for invalid lookup type', async () => {
    const res = await request(app)
      .get('/api/master/lookups/invalid-type')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(400);
  });

  it('returns items for all valid lookup types', async () => {
    const types = ['title', 'country', 'wingtype', 'sponsortype', 'hearabout', 'registerinterest'];
    for (const type of types) {
      const res = await request(app)
        .get(`/api/master/lookups/${type}`)
        .set('Authorization', bearer(token));
      expect(res.status).toBe(200);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/master/lookups/:type', () => {
  it('creates a lookup entry', async () => {
    const res = await request(app)
      .post('/api/master/lookups/title')
      .set('Authorization', bearer(token))
      .send({ name: 'Dr' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Dr');
  });

  it('rejects duplicate name with 409', async () => {
    await request(app)
      .post('/api/master/lookups/title')
      .set('Authorization', bearer(token))
      .send({ name: 'Prof' });

    const res = await request(app)
      .post('/api/master/lookups/title')
      .set('Authorization', bearer(token))
      .send({ name: 'Prof' });

    expect(res.status).toBe(409);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/master/lookups/title')
      .set('Authorization', bearer(token))
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/master/lookups/:type/:id', () => {
  let lookupId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/master/lookups/country')
      .set('Authorization', bearer(token))
      .send({ name: 'TestLand' });
    lookupId = res.body._id;
  });

  it('updates lookup entry name', async () => {
    const res = await request(app)
      .patch(`/api/master/lookups/country/${lookupId}`)
      .set('Authorization', bearer(token))
      .send({ name: 'UpdatedLand' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('UpdatedLand');
  });

  it('returns 404 for unknown id', async () => {
    const { Types } = require('mongoose');
    const res = await request(app)
      .patch(`/api/master/lookups/country/${new Types.ObjectId()}`)
      .set('Authorization', bearer(token))
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /api/master/lookups/:type/:id', () => {
  let lookupId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/master/lookups/wingtype')
      .set('Authorization', bearer(token))
      .send({ name: 'ToDeleteWing' });
    lookupId = res.body._id;
  });

  it('soft-deletes lookup entry', async () => {
    const res = await request(app)
      .delete(`/api/master/lookups/wingtype/${lookupId}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('deleted');
  });

  it('returns 404 for unknown id', async () => {
    const { Types } = require('mongoose');
    const res = await request(app)
      .delete(`/api/master/lookups/wingtype/${new Types.ObjectId()}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(404);
  });
});
