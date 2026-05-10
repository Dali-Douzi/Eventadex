'use strict';

/**
 * Tests for:
 *  - POST /api/public/:orgSlug/create-payment-intent
 *  - Payment verification during POST /api/public/:orgSlug/register
 *
 * Stripe is mocked at the module level so no real API calls are made.
 */

jest.mock('../services/emailService', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendTestEmail:         jest.fn().mockResolvedValue(undefined),
}));

// Mock Stripe before any module imports that might trigger require('stripe')
const mockCreate   = jest.fn();
const mockRetrieve = jest.fn();

jest.mock('stripe', () =>
  jest.fn(() => ({
    paymentIntents: {
      create:   mockCreate,
      retrieve: mockRetrieve,
    },
  }))
);

const request       = require('supertest');
const app           = require('../app');
const db            = require('./db');
const { Event, Registrant } = require('../models');
const {
  seedMaster, seedOrg, loginAdmin, bearer, ORG_SLUG,
} = require('./helpers');

const TICKET_PRICE = 75; // $75.00

let token;
let org, event, session;

beforeAll(async () => {
  await db.connect();
  // Stripe's getStripe() throws if STRIPE_SECRET_KEY is missing
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_jest';
  await seedMaster();
  const seeded = await seedOrg();
  org     = seeded.org;
  event   = seeded.event;
  session = seeded.session;
  token   = await loginAdmin(app);
});

afterAll(db.disconnect);

// Clear mock history between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// ─── POST create-payment-intent ───────────────────────────────────────────────

describe('POST /api/public/:orgSlug/create-payment-intent', () => {
  it('returns 400 when payment is not enabled for the event', async () => {
    // seedOrg creates the event with paymentEnabled: false
    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/create-payment-intent`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not enabled/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when ticketPrice is 0 or not set', async () => {
    await Event.findByIdAndUpdate(event._id, { paymentEnabled: true, ticketPrice: 0 });

    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/create-payment-intent`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/price/i);
  });

  it('calls stripe.paymentIntents.create and returns clientSecret', async () => {
    await Event.findByIdAndUpdate(event._id, { paymentEnabled: true, ticketPrice: TICKET_PRICE });
    mockCreate.mockResolvedValueOnce({ client_secret: 'pi_test_secret_abc' });

    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/create-payment-intent`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('clientSecret', 'pi_test_secret_abc');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('creates intent with correct amount in cents and lowercased currency', async () => {
    await Event.findByIdAndUpdate(event._id, {
      paymentEnabled: true,
      ticketPrice:    99.99,
      currency:       'USD',
    });
    mockCreate.mockResolvedValueOnce({ client_secret: 'pi_test_cents' });

    await request(app)
      .post(`/api/public/${ORG_SLUG}/create-payment-intent`)
      .send({});

    const call = mockCreate.mock.calls[0][0];
    expect(call.amount).toBe(9999);     // $99.99 → 9999 cents
    expect(call.currency).toBe('usd');  // must be lowercased for Stripe
  });

  it('includes orgId and eventId in Stripe metadata', async () => {
    await Event.findByIdAndUpdate(event._id, { paymentEnabled: true, ticketPrice: 10 });
    mockCreate.mockResolvedValueOnce({ client_secret: 'pi_meta' });

    await request(app)
      .post(`/api/public/${ORG_SLUG}/create-payment-intent`)
      .send({});

    const call = mockCreate.mock.calls[0][0];
    expect(call.metadata.orgId).toBe(org._id.toString());
    expect(call.metadata.eventId).toBe(event._id.toString());
  });

  it('returns 404 for an unknown org slug', async () => {
    const res = await request(app)
      .post('/api/public/no-such-org/create-payment-intent')
      .send({});

    expect(res.status).toBe(404);
  });
});

// ─── Payment verification during registration ─────────────────────────────────

describe('POST /api/public/:orgSlug/register  (payment-enabled event)', () => {
  // Enable payment before this block, disable after
  beforeAll(async () => {
    await Event.findByIdAndUpdate(event._id, {
      paymentEnabled: true,
      ticketPrice:    TICKET_PRICE,
      currency:       'USD',
    });
  });

  afterAll(async () => {
    await Event.findByIdAndUpdate(event._id, { paymentEnabled: false });
  });

  it('returns 400 when paymentIntentId is absent', async () => {
    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'Pay',
        lastName:  'Test',
        email:     `nointent-${Date.now()}@example.com`,
        sessionId: session._id.toString(),
        // no paymentIntentId
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/payment/i);
  });

  it('returns 400 when Stripe payment intent status is not "succeeded"', async () => {
    mockRetrieve.mockResolvedValueOnce({
      status: 'requires_payment_method',
      amount: TICKET_PRICE * 100,
    });

    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'Pay',
        lastName:  'Test',
        email:     `pending-${Date.now()}@example.com`,
        sessionId: session._id.toString(),
        paymentIntentId: 'pi_test_pending',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not been confirmed|status/i);
  });

  it('returns 400 when payment amount does not match the ticket price', async () => {
    mockRetrieve.mockResolvedValueOnce({
      status: 'succeeded',
      amount: 100, // $1.00 instead of $75.00
    });

    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'Pay',
        lastName:  'Wrong',
        email:     `wrongamt-${Date.now()}@example.com`,
        sessionId: session._id.toString(),
        paymentIntentId: 'pi_test_wrong_amount',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/amount/i);
  });

  it('returns 400 when stripe.retrieve throws', async () => {
    mockRetrieve.mockRejectedValueOnce(new Error('No such payment_intent'));

    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'Pay',
        lastName:  'Error',
        email:     `retrieveerr-${Date.now()}@example.com`,
        sessionId: session._id.toString(),
        paymentIntentId: 'pi_test_bad_id',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/verify payment/i);
  });

  it('returns 201 when payment intent is valid and amount matches', async () => {
    mockRetrieve.mockResolvedValueOnce({
      status: 'succeeded',
      amount: TICKET_PRICE * 100,
    });

    const res = await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'Paid',
        lastName:  'User',
        email:     `paid-${Date.now()}@example.com`,
        sessionId: session._id.toString(),
        paymentIntentId: 'pi_test_succeeded',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('stores paymentStatus as "paid" after successful payment', async () => {
    mockRetrieve.mockResolvedValueOnce({
      status: 'succeeded',
      amount: TICKET_PRICE * 100,
    });

    const email = `paidcheck-${Date.now()}@example.com`;
    await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'PaidStatus',
        lastName:  'Check',
        email,
        sessionId: session._id.toString(),
        paymentIntentId: 'pi_test_status_check',
      });

    const reg = await Registrant.findOne({ email });
    expect(reg).not.toBeNull();
    expect(reg.paymentStatus).toBe('paid');
    expect(reg.paymentIntentId).toBe('pi_test_status_check');
  });

  it('stores paymentIntentId on the registrant', async () => {
    const intentId = `pi_test_id_${Date.now()}`;
    mockRetrieve.mockResolvedValueOnce({
      status: 'succeeded',
      amount: TICKET_PRICE * 100,
    });

    const email = `intentid-${Date.now()}@example.com`;
    await request(app)
      .post(`/api/public/${ORG_SLUG}/register`)
      .send({
        firstName: 'IntentID',
        lastName:  'Test',
        email,
        sessionId: session._id.toString(),
        paymentIntentId: intentId,
      });

    const reg = await Registrant.findOne({ email });
    expect(reg.paymentIntentId).toBe(intentId);
  });
});
