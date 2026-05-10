'use strict';

jest.mock('../services/emailService', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendTestEmail:         jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const app     = require('../app');
const db      = require('./db');
const {
  seedOrg, seedRegistrant, ORG_SLUG,
} = require('./helpers');

let org, event, session;

beforeAll(async () => {
  await db.connect();
  const seeded = await seedOrg();
  org     = seeded.org;
  event   = seeded.event;
  session = seeded.session;
});

afterAll(db.disconnect);

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/public/:orgSlug  (form config)', () => {
  it('returns 200 with event, pageConfig, and sessions', async () => {
    const res = await request(app).get(`/api/public/${ORG_SLUG}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('event');
    expect(res.body).toHaveProperty('pageConfig');
    expect(res.body).toHaveProperty('sessions');
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBeGreaterThan(0);
    expect(res.body.event.name).toBe('Test Event 2026');
  });

  it('sessions include remainingCapacity', async () => {
    const res = await request(app).get(`/api/public/${ORG_SLUG}`);
    const s = res.body.sessions[0];
    expect(s).toHaveProperty('remainingCapacity');
    expect(s).toHaveProperty('isFull');
    expect(s.remainingCapacity).toBe(s.capacity - (s.registered || 0));
  });

  it('returns 404 for unknown slug', async () => {
    const res = await request(app).get('/api/public/no-such-slug');
    expect(res.status).toBe(404);
  });

  it('returns 404 for inactive org', async () => {
    const { Organization } = require('../models');
    await Organization.findByIdAndUpdate(org._id, { status: 'suspended' });

    const res = await request(app).get(`/api/public/${ORG_SLUG}`);
    expect(res.status).toBe(404);

    await Organization.findByIdAndUpdate(org._id, { status: 'active' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/public/:orgSlug/register', () => {
  const validPayload = () => ({
    firstName: 'Alice',
    lastName:  'Smith',
    email:     `alice-${Date.now()}@example.com`,
    sessionId: null, // set per test
  });

  it('registers successfully and returns 201 with registrantId', async () => {
    const payload = { ...validPayload(), sessionId: session._id.toString() };
    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('registrantId');
    expect(res.body).toHaveProperty('qrCode');
  });

  it('rejects duplicate email with 409', async () => {
    const email = `dup-${Date.now()}@example.com`;
    const payload = { firstName: 'Dup', lastName: 'User', email, sessionId: session._id.toString() };

    await request(app).post(`/api/public/${ORG_SLUG}/register`).send(payload);
    const res = await request(app).post(`/api/public/${ORG_SLUG}/register`).send(payload);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('rejects missing firstName with 422', async () => {
    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({ lastName: 'X', email: 'x@example.com', sessionId: session._id.toString() });

    expect(res.status).toBe(422);
  });

  it('rejects invalid email with 422', async () => {
    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({ firstName: 'X', lastName: 'Y', email: 'not-email', sessionId: session._id.toString() });

    expect(res.status).toBe(422);
  });

  it('rejects invalid sessionId format with 422', async () => {
    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({ firstName: 'X', lastName: 'Y', email: 'x@x.com', sessionId: 'not-an-id' });

    expect(res.status).toBe(422);
  });

  it('rejects non-existent sessionId with 400', async () => {
    const { Types } = require('mongoose');
    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'X', lastName: 'Y', email: 'x2@x.com',
        sessionId: new Types.ObjectId().toString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/session/i);
  });

  it('rejects when session is full with 400', async () => {
    // The Afternoon Session has capacity 2
    const afternoonSession = event.sessions[1];

    // Fill it up
    const emails = [`full1-${Date.now()}@x.com`, `full2-${Date.now()}@x.com`];
    for (const email of emails) {
      await request(app)
        .post(`/api/public/${ORG_SLUG}/register`)
        .send({ firstName: 'F', lastName: 'L', email, sessionId: afternoonSession._id.toString() });
    }

    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'Over', lastName: 'Capacity',
        email: `overcap-${Date.now()}@x.com`,
        sessionId: afternoonSession._id.toString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/full|no spots/i);
  });

  it('returns 404 for unknown org slug', async () => {
    const res = await request(app)
      .post('/api/public/ghost-org/register')
      .send({ firstName: 'X', lastName: 'Y', email: 'x@x.com', sessionId: session._id.toString() });

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/public/:orgSlug/registrant/:id', () => {
  let registrantId;

  beforeAll(async () => {
    const r = await seedRegistrant(org._id, event._id, session._id);
    registrantId = r._id.toString();
  });

  it('returns 200 with qrCodeImage', async () => {
    const res = await request(app).get(`/api/public/${ORG_SLUG}/registrant/${registrantId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('qrCodeImage');
    expect(res.body.qrCodeImage).toMatch(/^data:image\/png;base64,/);
    expect(res.body.firstName).toBe('John');
  });

  it('returns 404 for unknown registrant ID', async () => {
    const { Types } = require('mongoose');
    const res = await request(app)
      .get(`/api/public/${ORG_SLUG}/registrant/${new Types.ObjectId()}`);

    expect(res.status).toBe(404);
  });

  it('returns 422 for invalid ID format', async () => {
    const res = await request(app)
      .get(`/api/public/${ORG_SLUG}/registrant/not-a-mongo-id`);

    expect(res.status).toBe(422);
  });
});
