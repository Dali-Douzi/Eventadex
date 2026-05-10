'use strict';

/**
 * Tests for:
 *  - POST /api/admin/email-template/test
 *  - sendConfirmationEmail called (and with correct args) after registration
 *  - sendConfirmationEmail called after VIP registration
 *  - Email service failure does not break registration (fire-and-forget)
 */

const emailService = require('../services/emailService');

jest.mock('../services/emailService', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendTestEmail:         jest.fn().mockResolvedValue(undefined),
}));

const request         = require('supertest');
const app             = require('../app');
const db              = require('./db');
const { EmailTemplate } = require('../models');
const {
  seedMaster, seedOrg,
  loginAdmin, bearer, ORG_SLUG,
} = require('./helpers');

let token;
let org, event, session;

beforeAll(async () => {
  await db.connect();
  await seedMaster();
  const seeded = await seedOrg();
  org     = seeded.org;
  event   = seeded.event;
  session = seeded.session;
  token   = await loginAdmin(app);
});

afterAll(db.disconnect);

// Clear mock call history before each test so counts are independent
beforeEach(() => {
  jest.clearAllMocks();
});

// ─── POST /api/admin/email-template/test ─────────────────────────────────────

describe('POST /api/admin/email-template/test', () => {
  it('returns 200 and calls sendTestEmail once', async () => {
    const res = await request(app)
      .post('/api/admin/email-template/test')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/sent/i);
    expect(emailService.sendTestEmail).toHaveBeenCalledTimes(1);
  });

  it('passes the current email template to sendTestEmail', async () => {
    await request(app)
      .put('/api/admin/email-template')
      .set('Authorization', bearer(token))
      .send({ subject: 'Unique Subject XYZ' });

    await request(app)
      .post('/api/admin/email-template/test')
      .set('Authorization', bearer(token));

    const callArg = emailService.sendTestEmail.mock.calls[0][0];
    expect(callArg.emailTemplate.subject).toBe('Unique Subject XYZ');
  });

  it('returns 404 when no email template exists for the org', async () => {
    await EmailTemplate.deleteOne({ organizationId: org._id });

    const res = await request(app)
      .post('/api/admin/email-template/test')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(404);

    // Restore so later tests are unaffected
    await EmailTemplate.create({
      organizationId: org._id,
      subject:        'Your Registration Confirmation',
    });
  });

  it('returns 401 without an auth token', async () => {
    const res = await request(app).post('/api/admin/email-template/test');
    expect(res.status).toBe(401);
  });

  it('does not call sendTestEmail when unauthenticated', async () => {
    await request(app).post('/api/admin/email-template/test');
    expect(emailService.sendTestEmail).not.toHaveBeenCalled();
  });
});

// ─── Confirmation email on normal registration ────────────────────────────────

describe('Confirmation email — normal registration', () => {
  it('calls sendConfirmationEmail once after a successful registration', async () => {
    await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'Email',
        lastName:  'Tester',
        email:     `emailtest-${Date.now()}@example.com`,
        sessionId: session._id.toString(),
      });

    // Fire-and-forget: let the promise settle
    await new Promise((r) => setTimeout(r, 50));

    expect(emailService.sendConfirmationEmail).toHaveBeenCalledTimes(1);
  });

  it('passes the correct registrant firstName to sendConfirmationEmail', async () => {
    await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'FirstNameCheck',
        lastName:  'User',
        email:     `fncheck-${Date.now()}@example.com`,
        sessionId: session._id.toString(),
      });

    await new Promise((r) => setTimeout(r, 50));

    const args = emailService.sendConfirmationEmail.mock.calls[0][0];
    expect(args.registrant.firstName).toBe('FirstNameCheck');
  });

  it('passes the event name to sendConfirmationEmail', async () => {
    await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'Event',
        lastName:  'Check',
        email:     `evcheck-${Date.now()}@example.com`,
        sessionId: session._id.toString(),
      });

    await new Promise((r) => setTimeout(r, 50));

    const args = emailService.sendConfirmationEmail.mock.calls[0][0];
    expect(args.event.name).toBe('Test Event 2026');
  });

  it('passes a qrCodeDataUrl (base64 PNG) to sendConfirmationEmail', async () => {
    await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'QR',
        lastName:  'Check',
        email:     `qrcheck-${Date.now()}@example.com`,
        sessionId: session._id.toString(),
      });

    await new Promise((r) => setTimeout(r, 50));

    const args = emailService.sendConfirmationEmail.mock.calls[0][0];
    expect(args.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('does NOT call sendConfirmationEmail when registration is rejected (422)', async () => {
    await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({ firstName: 'Missing' }); // missing required fields → 422

    await new Promise((r) => setTimeout(r, 50));

    expect(emailService.sendConfirmationEmail).not.toHaveBeenCalled();
  });
});

// ─── Confirmation email on VIP registration ───────────────────────────────────

describe('Confirmation email — VIP registration', () => {
  it('calls sendConfirmationEmail once after a VIP registration', async () => {
    await request(app)
      .post(`/api/public/${ORG_SLUG}/vip/register`)
      .send({
        firstName: 'VIP',
        lastName:  'EmailCheck',
        email:     `vipmail-${Date.now()}@example.com`,
        sessionId: session._id.toString(),
      });

    await new Promise((r) => setTimeout(r, 50));

    expect(emailService.sendConfirmationEmail).toHaveBeenCalledTimes(1);
    const args = emailService.sendConfirmationEmail.mock.calls[0][0];
    expect(args.registrant.firstName).toBe('VIP');
  });
});

// ─── Fire-and-forget resilience ───────────────────────────────────────────────

describe('Email service failure resilience', () => {
  it('registration still returns 201 even when sendConfirmationEmail rejects', async () => {
    emailService.sendConfirmationEmail.mockRejectedValueOnce(new Error('SMTP timeout'));

    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'Resilient',
        lastName:  'User',
        email:     `resilient-${Date.now()}@example.com`,
        sessionId: session._id.toString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('VIP registration still returns 201 when sendConfirmationEmail rejects', async () => {
    emailService.sendConfirmationEmail.mockRejectedValueOnce(new Error('SMTP timeout'));

    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/vip/register`)
      .send({
        firstName: 'ResilientVIP',
        lastName:  'User',
        email:     `resilientvip-${Date.now()}@example.com`,
        sessionId: session._id.toString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});
