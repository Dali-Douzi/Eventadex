#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * cleanup.js — Delete all E2E test data and demo data from the database.
 *
 * Deletes:
 *   • Organizations whose name starts with "E2E Playwright" or "Demo Org"
 *   • Removes .test-state.json
 *
 * Usage (from e2e/ directory):
 *   node cleanup.js
 *
 * Or override credentials via env:
 *   MASTER_EMAIL=... MASTER_PASSWORD=... node cleanup.js
 */

require('dotenv').config({ path: __dirname + '/.env' });
const fs   = require('fs');
const path = require('path');
const axios = require('axios');

const API      = process.env.API_URL         || 'http://localhost:5000';
const M_EMAIL  = process.env.MASTER_EMAIL    || 'master@example.com';
const M_PWD    = process.env.MASTER_PASSWORD || 'masterpassword';

const STATE_FILE = path.join(__dirname, '.test-state.json');

const DEMO_PATTERNS = [
  /^E2E Playwright/i,
  /^Demo Org/i,
];

function isTestOrg(name = '') {
  return DEMO_PATTERNS.some((re) => re.test(name));
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Eventadex E2E Cleanup Script');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  API   : ${API}`);
  console.log(`  Master: ${M_EMAIL}`);
  console.log('');

  // ── 1. Master login ──────────────────────────────────────────────────────
  let token;
  try {
    const { data } = await axios.post(`${API}/api/auth/master/login`, {
      email: M_EMAIL,
      password: M_PWD,
    });
    token = data.token;
    if (!token) throw new Error('No token returned');
    console.log('✓ Logged in as master admin');
  } catch (err) {
    console.error('✗ Master login failed:', err.response?.data?.message || err.message);
    process.exit(1);
  }

  const api = axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${token}` },
  });

  // ── 2. Fetch all organizations (paginate through all pages) ──────────────
  let allOrgs = [];
  let page = 1;
  const limit = 100;

  console.log('  Fetching organizations…');
  while (true) {
    try {
      const { data } = await api.get('/api/master/organizations', {
        params: { page, limit },
      });
      const orgs = data.data || [];
      allOrgs = allOrgs.concat(orgs);
      if (orgs.length < limit) break; // last page
      page++;
    } catch (err) {
      console.error('✗ Failed to fetch organizations:', err.response?.data?.message || err.message);
      process.exit(1);
    }
  }

  console.log(`  Found ${allOrgs.length} total organization(s)`);

  // ── 3. Filter to test/demo orgs ─────────────────────────────────────────
  const toDelete = allOrgs.filter((o) => isTestOrg(o.name));

  if (toDelete.length === 0) {
    console.log('  No test/demo organizations found — nothing to delete.');
  } else {
    console.log(`\n  Banishing ${toDelete.length} test/demo organization(s):\n`);

    for (const org of toDelete) {
      try {
        // Banish = permanent hard delete (removes org + all linked data from DB)
        await api.delete(`/api/master/organizations/${org._id}/banish`);
        console.log(`  ✓ Banished: "${org.name}" (${org._id})`);
      } catch (err) {
        const msg = err.response?.data?.message || err.message;
        console.warn(`  ✗ Could not banish "${org.name}": ${msg}`);
      }
    }
  }

  // ── 4. Remove state file ─────────────────────────────────────────────────
  console.log('');
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
    console.log('✓ Removed .test-state.json');
  } else {
    console.log('  .test-state.json not found (already clean)');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Cleanup complete.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
