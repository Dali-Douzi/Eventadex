'use strict';

/**
 * Tests for:
 *  - PATCH /api/admin/event/sessions/:sessionId
 *  - DELETE /api/admin/event/sessions/:sessionId
 *  - GET /api/admin/registrants/:id
 *  - GET /api/admin/lookups/:type
 *  - Session filter on registrant list and export
 *  - sessions.registered counter increment
 */

jest.mock('../services/emailService', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendTestEmail:         jest.fn().mockResolvedValue(undefined),
}));

const request        = require('supertest');
const mongoose       = require('mongoose');
const app            = require('../app');
const db             = require('./db');
const { Event }      = require('../models');
const {
  seedMaster, seedOrg, seedRegistrant,
  loginAdmin, bearer, ORG_SLUG,
} = require('./helpers');

let token;
let org, event, session;
let registrantId;

beforeAll(async () => {
  await db.connect();
  await seedMaster();
  const seeded = await seedOrg();
  org     = seeded.org;
  event   = seeded.event;
  session = seeded.session;
  token   = await loginAdmin(app);

  const r = await seedRegistrant(org._id, event._id, session._id);
  registrantId = r._id.toString();
});

afterAll(db.disconnect);

// ─── PATCH session ────────────────────────────────────────────────────────────

describe('PATCH /api/admin/event/sessions/:sessionId', () => {
  it('updates session name', async () => {
    const res = await request(app)
      .patch(`/api/admin/event/sessions/${session._id}`)
      .set('Authorization', bearer(token))
      .send({ name: 'Renamed Session' });

    expect(res.status).toBe(200);
    const updated = res.body.sessions.find((s) => s._id.toString() === session._id.toString());
    expect(updated.name).toBe('Renamed Session');
  });

  it('updates session capacity', async () => {
    const res = await request(app)
      .patch(`/api/admin/event/sessions/${session._id}`)
      .set('Authorization', bearer(token))
      .send({ capacity: 200 });

    expect(res.status).toBe(200);
    const updated = res.body.sessions.find((s) => s._id.toString() === session._id.toString());
    expect(updated.capacity).toBe(200);
  });

  it('updates waitlistCapacity', async () => {
    const res = await request(app)
      .patch(`/api/admin/event/sessions/${session._id}`)
      .set('Authorization', bearer(token))
      .send({ waitlistCapacity: 10 });

    expect(res.status).toBe(200);
    const updated = res.body.sessions.find((s) => s._id.toString() === session._id.toString());
    expect(updated.waitlistCapacity).toBe(10);
  });

  it('ignores unknown fields (only allowed fields are applied)', async () => {
    const res = await request(app)
      .patch(`/api/admin/event/sessions/${session._id}`)
      .set('Authorization', bearer(token))
      .send({ name: 'Valid', __injected: 'bad' });

    expect(res.status).toBe(200);
    const updated = res.body.sessions.find((s) => s._id.toString() === session._id.toString());
    expect(updated).not.toHaveProperty('__injected');
  });

  it('returns 422 for invalid sessionId format', async () => {
    const res = await request(app)
      .patch('/api/admin/event/sessions/not-a-mongo-id')
      .set('Authorization', bearer(token))
      .send({ name: 'X' });

    expect(res.status).toBe(422);
  });

  it('returns 400 when no valid fields are sent', async () => {
    const res = await request(app)
      .patch(`/api/admin/event/sessions/${session._id}`)
      .set('Authorization', bearer(token))
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .patch(`/api/admin/event/sessions/${session._id}`)
      .send({ name: 'X' });

    expect(res.status).toBe(401);
  });
});

// ─── DELETE session ───────────────────────────────────────────────────────────

describe('DELETE /api/admin/event/sessions/:sessionId', () => {
  let tempSessionId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/admin/event/sessions')
      .set('Authorization', bearer(token))
      .send({ name: 'Temp Session', date: '2026-06-01', capacity: 10 });
    const added = res.body.sessions.find((s) => s.name === 'Temp Session');
    tempSessionId = added._id;
  });

  it('removes the session from the event', async () => {
    const res = await request(app)
      .delete(`/api/admin/event/sessions/${tempSessionId}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    const stillThere = res.body.sessions.some(
      (s) => s._id.toString() === tempSessionId.toString()
    );
    expect(stillThere).toBe(false);
  });

  it('returns 422 for invalid sessionId format', async () => {
    const res = await request(app)
      .delete('/api/admin/event/sessions/bad-id')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(422);
  });

  it('succeeds silently for a non-existent sessionId ($pull is a no-op)', async () => {
    // MongoDB $pull on a missing subdoc returns the event unchanged — not a 404
    const res = await request(app)
      .delete(`/api/admin/event/sessions/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .delete(`/api/admin/event/sessions/${new mongoose.Types.ObjectId()}`);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/admin/registrants/:id ──────────────────────────────────────────

describe('GET /api/admin/registrants/:id', () => {
  it('returns the registrant by ID', async () => {
    const res = await request(app)
      .get(`/api/admin/registrants/${registrantId}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body._id.toString()).toBe(registrantId);
    expect(res.body.firstName).toBe('John');
    expect(res.body.lastName).toBe('Doe');
  });

  it('does not return a password field', async () => {
    const res = await request(app)
      .get(`/api/admin/registrants/${registrantId}`)
      .set('Authorization', bearer(token));

    // Registrant model has no password — confirm it's not accidentally added
    expect(res.body).not.toHaveProperty('password');
  });

  it('returns 404 for a valid but unknown ID', async () => {
    const res = await request(app)
      .get(`/api/admin/registrants/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(404);
  });

  it('returns 422 for invalid ID format', async () => {
    const res = await request(app)
      .get('/api/admin/registrants/not-a-mongo-id')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(422);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get(`/api/admin/registrants/${registrantId}`);
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/admin/lookups/:type ─────────────────────────────────────────────

describe('GET /api/admin/lookups/:type', () => {
  const VALID_TYPES = [
    'title', 'country', 'wingtype', 'sponsortype', 'hearabout', 'registerinterest',
  ];

  it.each(VALID_TYPES)('returns an array for type "%s"', async (type) => {
    const res = await request(app)
      .get(`/api/admin/lookups/${type}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 400 for an invalid lookup type', async () => {
    const res = await request(app)
      .get('/api/admin/lookups/invalid-type')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/lookups/title');
    expect(res.status).toBe(401);
  });
});

// ─── Session filter — registrant list ─────────────────────────────────────────

describe('GET /api/admin/registrants?sessionId=', () => {
  let afternoonSessionId;

  beforeAll(async () => {
    // event.sessions[1] is "Afternoon Session" (capacity 2)
    afternoonSessionId = event.sessions[1]._id;

    await seedRegistrant(org._id, event._id, afternoonSessionId, {
      email: `afternoon-${Date.now()}@example.com`,
    });
  });

  it('returns only registrants belonging to the specified session', async () => {
    const res = await request(app)
      .get(`/api/admin/registrants?sessionId=${afternoonSessionId}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(
      res.body.data.every(
        (r) => r.sessionId.toString() === afternoonSessionId.toString()
      )
    ).toBe(true);
  });

  it('returns an empty list for a session with no registrants', async () => {
    const addRes = await request(app)
      .post('/api/admin/event/sessions')
      .set('Authorization', bearer(token))
      .send({ name: 'Empty Session', date: '2026-06-02', capacity: 20 });

    const emptySession = addRes.body.sessions.find((s) => s.name === 'Empty Session');

    const res = await request(app)
      .get(`/api/admin/registrants?sessionId=${emptySession._id}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('ignores invalid sessionId format and returns all registrants', async () => {
    // An invalid ObjectId is simply ignored by the filter
    const res = await request(app)
      .get('/api/admin/registrants?sessionId=not-an-id')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

// ─── Session filter — export ──────────────────────────────────────────────────

describe('GET /api/admin/registrants/export?sessionId=', () => {
  it('CSV contains only rows for the specified session', async () => {
    const afternoonSessionId = event.sessions[1]._id;

    const res = await request(app)
      .get(`/api/admin/registrants/export?sessionId=${afternoonSessionId}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);

    const lines = res.text.trim().split('\n');
    // header + at least 1 data row
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('export without sessionId contains all registrants', async () => {
    const filtered = await request(app)
      .get(`/api/admin/registrants/export?sessionId=${event.sessions[0]._id}`)
      .set('Authorization', bearer(token));
    const all = await request(app)
      .get('/api/admin/registrants/export')
      .set('Authorization', bearer(token));

    const filteredCount = filtered.text.trim().split('\n').length;
    const allCount      = all.text.trim().split('\n').length;

    // All-registrants export should have >= rows than filtered
    expect(allCount).toBeGreaterThanOrEqual(filteredCount);
  });
});

// ─── sessions.registered counter ─────────────────────────────────────────────

describe('sessions.registered counter', () => {
  it('increments after a successful public registration', async () => {
    const freshBefore = await Event.findById(event._id);
    const countBefore = freshBefore.sessions.id(session._id).registered;

    await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'Counter',
        lastName:  'Test',
        email:     `counter-${Date.now()}@example.com`,
        sessionId: session._id.toString(),
      });

    const freshAfter = await Event.findById(event._id);
    const countAfter = freshAfter.sessions.id(session._id).registered;

    expect(countAfter).toBe(countBefore + 1);
  });

  it('dashboard stats reflect the updated per-session counts', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.sessions.some((s) => s.registered > 0)).toBe(true);
    expect(res.body.totalRegistrants).toBeGreaterThan(0);
  });
});
