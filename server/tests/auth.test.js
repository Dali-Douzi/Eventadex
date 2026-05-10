'use strict';

const request = require('supertest');
const app     = require('../app');
const db      = require('./db');
const { seedMaster, seedOrg, MASTER_CREDS, ADMIN_CREDS } = require('./helpers');

beforeAll(async () => {
  await db.connect();
  await seedMaster();
  await seedOrg();
});

afterAll(db.disconnect);

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/master/login', () => {
  it('returns 200 + token with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/master/login')
      .send(MASTER_CREDS);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('master');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('returns 401 with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/master/login')
      .send({ email: MASTER_CREDS.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('returns 401 with unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/master/login')
      .send({ email: 'nobody@test.com', password: 'irrelevant' });

    expect(res.status).toBe(401);
  });

  it('returns 422 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/master/login')
      .send({ password: 'somepass' });

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 422 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/master/login')
      .send({ email: MASTER_CREDS.email });

    expect(res.status).toBe(422);
  });

  it('returns 422 when email format is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/master/login')
      .send({ email: 'not-an-email', password: 'pass' });

    expect(res.status).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/admin/login', () => {
  it('returns 200 + token + slug with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send(ADMIN_CREDS);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user).toHaveProperty('slug');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('returns 401 with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: ADMIN_CREDS.email, password: 'badpass' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for a suspended org', async () => {
    const { Organization } = require('../models');
    await Organization.findOneAndUpdate(
      { email: ADMIN_CREDS.email },
      { status: 'suspended' }
    );

    const res = await request(app)
      .post('/api/auth/admin/login')
      .send(ADMIN_CREDS);

    expect(res.status).toBe(403);

    // Restore
    await Organization.findOneAndUpdate(
      { email: ADMIN_CREDS.email },
      { status: 'active' }
    );
  });

  it('returns 422 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'bad', password: 'pass' });

    expect(res.status).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  let masterToken;
  let adminToken;

  beforeAll(async () => {
    const mRes = await request(app).post('/api/auth/master/login').send(MASTER_CREDS);
    masterToken = mRes.body.token;

    const aRes = await request(app).post('/api/auth/admin/login').send(ADMIN_CREDS);
    adminToken = aRes.body.token;
  });

  it('returns 200 for master token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${masterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('master');
    expect(res.body).not.toHaveProperty('password');
  });

  it('returns 200 for admin token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.jwt');

    expect(res.status).toBe(401);
  });
});
