'use strict';

jest.mock('../services/emailService', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendTestEmail:         jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const app     = require('../app');
const db      = require('./db');
const {
  seedMaster, seedOrg, seedRegistrant,
  loginAdmin, bearer, ADMIN_CREDS, ORG_SLUG,
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

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth guard — admin routes reject unauthenticated requests', () => {
  it('GET /api/admin/event → 401 without token', async () => {
    const res = await request(app).get('/api/admin/event');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/registrants → 401 without token', async () => {
    const res = await request(app).get('/api/admin/registrants');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/admin/event', () => {
  it('returns event data', async () => {
    const res = await request(app)
      .get('/api/admin/event')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Event 2026');
    expect(res.body.sessions).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/admin/event', () => {
  it('updates event name', async () => {
    const res = await request(app)
      .patch('/api/admin/event')
      .set('Authorization', bearer(token))
      .send({ name: 'Updated Event Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Event Name');

    // Restore
    await request(app)
      .patch('/api/admin/event')
      .set('Authorization', bearer(token))
      .send({ name: 'Test Event 2026' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/admin/event/sessions', () => {
  it('adds a new session', async () => {
    const res = await request(app)
      .post('/api/admin/event/sessions')
      .set('Authorization', bearer(token))
      .send({ name: 'Evening Session', date: '2026-06-01', capacity: 30 });

    expect(res.status).toBe(201);
    const sessions = res.body.sessions;
    expect(sessions.some((s) => s.name === 'Evening Session')).toBe(true);
  });

  it('rejects missing session name with 422', async () => {
    const res = await request(app)
      .post('/api/admin/event/sessions')
      .set('Authorization', bearer(token))
      .send({ date: '2026-06-01', capacity: 10 });

    expect(res.status).toBe(422);
  });

  it('rejects invalid date format with 422', async () => {
    const res = await request(app)
      .post('/api/admin/event/sessions')
      .set('Authorization', bearer(token))
      .send({ name: 'Bad', date: 'not-a-date', capacity: 10 });

    expect(res.status).toBe(422);
  });

  it('rejects zero capacity with 422', async () => {
    const res = await request(app)
      .post('/api/admin/event/sessions')
      .set('Authorization', bearer(token))
      .send({ name: 'Zero', date: '2026-06-01', capacity: 0 });

    expect(res.status).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/admin/page-config', () => {
  it('returns page config', async () => {
    const res = await request(app)
      .get('/api/admin/page-config')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('primaryColor');
    expect(Array.isArray(res.body.formFields)).toBe(true);
  });
});

describe('PUT /api/admin/page-config', () => {
  it('updates page config fields', async () => {
    const res = await request(app)
      .put('/api/admin/page-config')
      .set('Authorization', bearer(token))
      .send({ headerText: 'New Header', primaryColor: '#ff0000' });

    expect(res.status).toBe(200);
    expect(res.body.headerText).toBe('New Header');
    expect(res.body.primaryColor).toBe('#ff0000');
  });

  it('does not overwrite organizationId from body', async () => {
    const { Types } = require('mongoose');
    const fakeId = new Types.ObjectId().toString();
    const res = await request(app)
      .put('/api/admin/page-config')
      .set('Authorization', bearer(token))
      .send({ organizationId: fakeId });

    expect(res.status).toBe(200);
    expect(res.body.organizationId.toString()).toBe(org._id.toString());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/admin/badge-config', () => {
  it('auto-creates and returns badge config', async () => {
    const res = await request(app)
      .get('/api/admin/badge-config')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('width');
    expect(res.body).toHaveProperty('height');
    expect(Array.isArray(res.body.fields)).toBe(true);
    expect(res.body.fields.length).toBeGreaterThan(0);
  });
});

describe('PUT /api/admin/badge-config', () => {
  it('updates badge dimensions', async () => {
    const res = await request(app)
      .put('/api/admin/badge-config')
      .set('Authorization', bearer(token))
      .send({ width: 90, height: 60 });

    expect(res.status).toBe(200);
    expect(res.body.width).toBe(90);
    expect(res.body.height).toBe(60);
  });

  it('does not overwrite backgroundImageUrl from body', async () => {
    const res = await request(app)
      .put('/api/admin/badge-config')
      .set('Authorization', bearer(token))
      .send({ backgroundImageUrl: '/fake/path.png', width: 85 });

    expect(res.status).toBe(200);
    // backgroundImageUrl should NOT be 'fake/path.png' (it's protected)
    expect(res.body.backgroundImageUrl).not.toBe('/fake/path.png');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/admin/registrants', () => {
  it('returns paginated registrants', async () => {
    const res = await request(app)
      .get('/api/admin/registrants')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns filtered results with search param', async () => {
    const res = await request(app)
      .get('/api/admin/registrants?search=John')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.every((r) =>
      r.firstName.match(/John/i) || r.lastName.match(/John/i) || r.email.match(/John/i)
    )).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/admin/registrants/search', () => {
  it('finds registrant by email', async () => {
    const res = await request(app)
      .get('/api/admin/registrants/search?q=john.doe@example.com')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('John');
    expect(res.body).toHaveProperty('badgeConfig');
  });

  it('finds registrant by QR code', async () => {
    const { Registrant } = require('../models');
    const r = await Registrant.findById(registrantId);
    const res = await request(app)
      .get(`/api/admin/registrants/search?q=${r.qrCode}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body._id.toString()).toBe(registrantId);
  });

  it('returns 404 for no match', async () => {
    const res = await request(app)
      .get('/api/admin/registrants/search?q=nobody@nowhere.com')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(404);
  });

  it('returns 400 when q param is missing', async () => {
    const res = await request(app)
      .get('/api/admin/registrants/search')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/admin/registrants/:id/checkin', () => {
  it('checks in a registrant', async () => {
    const res = await request(app)
      .patch(`/api/admin/registrants/${registrantId}/checkin`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.checkedIn).toBe(true);
    expect(res.body.checkedInAt).toBeTruthy();
  });

  it('returns 404 for unknown registrant ID', async () => {
    const { Types } = require('mongoose');
    const res = await request(app)
      .patch(`/api/admin/registrants/${new Types.ObjectId()}/checkin`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(404);
  });

  it('returns 422 for invalid ID format', async () => {
    const res = await request(app)
      .patch('/api/admin/registrants/bad-id/checkin')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(422);
  });
});

describe('PATCH /api/admin/registrants/:id/checkout', () => {
  it('checks out a registrant', async () => {
    const res = await request(app)
      .patch(`/api/admin/registrants/${registrantId}/checkout`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.checkedOut).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/admin/stats', () => {
  it('returns dashboard stats', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalRegistrants');
    expect(res.body).toHaveProperty('checkedInToday');
    expect(res.body).toHaveProperty('sessions');
    expect(typeof res.body.totalRegistrants).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/admin/email-template', () => {
  it('returns email template', async () => {
    const res = await request(app)
      .get('/api/admin/email-template')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('subject');
  });
});

describe('PUT /api/admin/email-template', () => {
  it('updates email template', async () => {
    const res = await request(app)
      .put('/api/admin/email-template')
      .set('Authorization', bearer(token))
      .send({ subject: 'New Subject Line' });

    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('New Subject Line');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/admin/registrants/export', () => {
  it('returns CSV content', async () => {
    const res = await request(app)
      .get('/api/admin/registrants/export')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toMatch(/First Name/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/admin/event/payment', () => {
  it('updates payment settings', async () => {
    const res = await request(app)
      .patch('/api/admin/event/payment')
      .set('Authorization', bearer(token))
      .send({ paymentEnabled: true, ticketPrice: 99.99, currency: 'USD' });

    expect(res.status).toBe(200);
    expect(res.body.paymentEnabled).toBe(true);
    expect(res.body.ticketPrice).toBe(99.99);

    // Reset
    await request(app)
      .patch('/api/admin/event/payment')
      .set('Authorization', bearer(token))
      .send({ paymentEnabled: false });
  });

  it('rejects invalid currency code with 422', async () => {
    const res = await request(app)
      .patch('/api/admin/event/payment')
      .set('Authorization', bearer(token))
      .send({ currency: 'TOOLONG' });

    expect(res.status).toBe(422);
  });
});
