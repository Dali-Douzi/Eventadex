// @ts-check
'use strict';

/**
 * globalSetup — runs once before all tests.
 *
 * 1. Logs in as master admin via the API
 * 2. Creates (or reuses) the E2E test organization
 * 3. Logs in as that org admin
 * 4. Ensures the org has a published event with two sessions
 * 5. Writes .test-state.json so specs can read org/event/session IDs
 */

require('dotenv').config({ path: __dirname + '/.env' });
const fs   = require('fs');
const path = require('path');
const axios = require('axios');

const API      = process.env.API_URL        || 'http://localhost:5000';
const M_EMAIL  = process.env.MASTER_EMAIL   || 'master@example.com';
const M_PWD    = process.env.MASTER_PASSWORD || 'masterpassword';
const O_EMAIL  = process.env.E2E_ORG_EMAIL  || 'e2e@playwright-test.com';
const O_PWD    = process.env.E2E_ORG_PASSWORD || 'E2ePlaywright!99';
const O_SLUG   = process.env.E2E_ORG_SLUG   || 'e2e-playwright';

const STATE_FILE = path.join(__dirname, '.test-state.json');

async function globalSetup() {
  // ── 1. Master login ───────────────────────────────────────────────────────
  let masterToken;
  try {
    const { data } = await axios.post(`${API}/api/auth/master/login`, {
      email: M_EMAIL, password: M_PWD,
    });
    masterToken = data.token;
    if (!masterToken) throw new Error('No token returned');
  } catch (err) {
    throw new Error(
      `[globalSetup] Master login failed. ` +
      `Make sure the server is running and MASTER_EMAIL/MASTER_PASSWORD are set.\n` +
      (err.response?.data?.message || err.message)
    );
  }

  const mApi = axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${masterToken}` },
  });

  // ── 2. Find or create E2E org ─────────────────────────────────────────────
  let org;

  // Search by slug first, then fall back to email search
  const slugRes = await mApi.get('/api/master/organizations', {
    params: { search: O_SLUG, limit: 10 },
  });
  org = slugRes.data.data.find((o) => o.slug === O_SLUG);

  if (!org) {
    const emailRes = await mApi.get('/api/master/organizations', {
      params: { search: O_EMAIL, limit: 10 },
    });
    org = emailRes.data.data.find((o) => o.email === O_EMAIL);
  }

  if (!org) {
    try {
      const createRes = await mApi.post('/api/master/organizations', {
        name:     'E2E Playwright Org',
        email:    O_EMAIL,
        password: O_PWD,
      });
      org = createRes.data;
      console.log('[globalSetup] Created E2E org:', org._id);
    } catch (err) {
      if (err.response?.status === 409) {
        // Created between our check and create — search all pages for it
        const allRes = await mApi.get('/api/master/organizations', {
          params: { limit: 100 },
        });
        org = allRes.data.data.find((o) => o.email === O_EMAIL);
        if (!org) throw new Error('[globalSetup] 409 conflict but org not found by email.');
        console.log('[globalSetup] Found existing E2E org after 409:', org._id);
      } else {
        throw err;
      }
    }
  } else {
    console.log('[globalSetup] Reusing existing E2E org:', org._id);
  }

  // Make sure it's active
  if (org.status !== 'active') {
    await mApi.patch(`/api/master/organizations/${org._id}`, { status: 'active' });
  }

  const orgId = org._id;

  // Update slug so we know the URL path
  await mApi.patch(`/api/master/organizations/${orgId}`, {
    name: 'E2E Playwright Org',
    email: O_EMAIL,
    slug: O_SLUG,
  });

  // ── 3. Admin login ────────────────────────────────────────────────────────
  let adminToken;
  try {
    const { data } = await axios.post(`${API}/api/auth/admin/login`, {
      email: O_EMAIL, password: O_PWD,
    });
    adminToken = data.token;
    if (!adminToken) throw new Error('No token returned');
  } catch (err) {
    throw new Error(
      `[globalSetup] Admin login failed for ${O_EMAIL}.\n` +
      (err.response?.data?.message || err.message)
    );
  }

  const aApi = axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  // ── 4. Ensure published event with sessions ───────────────────────────────
  let event;
  try {
    const { data } = await aApi.get('/api/admin/event');
    event = data;
  } catch {
    event = null;
  }

  // Set event to published with a good name & dates
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const eventPayload = {
    name:        'E2E Test Event 2026',
    description: 'Created by Playwright globalSetup',
    startDate:   tomorrow.toISOString().slice(0, 10),
    endDate:     dayAfter.toISOString().slice(0, 10),
    status:      'published',
  };

  const eventRes = await aApi.patch('/api/admin/event', eventPayload);
  event = eventRes.data;

  // ── 5. Ensure at least two sessions ──────────────────────────────────────
  // Delete existing sessions from previous runs to start clean
  if (event.sessions && event.sessions.length > 0) {
    for (const s of event.sessions) {
      try {
        await aApi.delete(`/api/admin/event/sessions/${s._id}`);
      } catch { /* ignore */ }
    }
  }

  // Add fresh sessions
  const s1Res = await aApi.post('/api/admin/event/sessions', {
    name: 'Morning Session',
    date: tomorrow.toISOString().slice(0, 10),
    capacity: 100,
    waitlistCapacity: 10,
  });
  event = s1Res.data;

  const s2Res = await aApi.post('/api/admin/event/sessions', {
    name: 'Afternoon Session',
    date: tomorrow.toISOString().slice(0, 10),
    capacity: 50,
    waitlistCapacity: 5,
  });
  event = s2Res.data;

  const sessions = event.sessions;
  const session1 = sessions[0];
  const session2 = sessions[1];

  // ── 6. Ensure email template exists ──────────────────────────────────────
  try {
    await aApi.get('/api/admin/email-template');
  } catch {
    // create a basic one
    await aApi.post('/api/admin/email-template', {
      subject: 'Your E2E Registration Confirmation',
      body: 'Hello {{firstName}}, you are registered for {{eventName}}!',
    }).catch(() => {});
  }

  // ── 7. Write state file ───────────────────────────────────────────────────
  const state = {
    orgId,
    orgName:      'E2E Playwright Org',
    orgSlug:      O_SLUG,
    orgEmail:     O_EMAIL,
    orgPassword:  O_PWD,
    masterEmail:  M_EMAIL,
    masterPassword: M_PWD,
    eventId:      event._id,
    eventName:    event.name,
    session1Id:   session1._id,
    session1Name: session1.name,
    session2Id:   session2._id,
    session2Name: session2.name,
    masterToken,
    adminToken,
    apiUrl:       API,
  };

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log('[globalSetup] State written to', STATE_FILE);
}

module.exports = globalSetup;
