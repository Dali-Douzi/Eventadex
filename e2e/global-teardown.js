// @ts-check
'use strict';

/**
 * globalTeardown — runs once after all tests.
 * Deletes the E2E test organization and cleans up the state file.
 */

require('dotenv').config({ path: __dirname + '/.env' });
const fs   = require('fs');
const path = require('path');
const axios = require('axios');

const STATE_FILE = path.join(__dirname, '.test-state.json');

async function globalTeardown() {
  if (!fs.existsSync(STATE_FILE)) return;

  let state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return;
  }

  const { apiUrl, masterToken, orgId } = state;
  if (!masterToken || !orgId) return;

  try {
    await axios.delete(`${apiUrl}/api/master/organizations/${orgId}`, {
      headers: { Authorization: `Bearer ${masterToken}` },
    });
    console.log('[globalTeardown] Deleted E2E org:', orgId);
  } catch (err) {
    console.warn('[globalTeardown] Could not delete E2E org:', err.response?.data?.message || err.message);
  }

  try { fs.unlinkSync(STATE_FILE); } catch { /* ignore */ }
}

module.exports = globalTeardown;
