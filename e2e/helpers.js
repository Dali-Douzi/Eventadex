// @ts-check
'use strict';

const fs   = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '.test-state.json');

/**
 * Read the .test-state.json file written by globalSetup.
 * @returns {Record<string, string>}
 */
function getState() {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error('.test-state.json not found — did globalSetup run?');
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

/**
 * Register an init script that sets admin localStorage BEFORE React mounts.
 * Call this once per page instance (e.g. in beforeEach), then navigate.
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, string>} state
 */
async function injectAdminAuth(page, state) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_user', JSON.stringify(user));
  }, {
    token: state.adminToken,
    user:  { email: state.orgEmail, orgId: state.orgId },
  });
}

/**
 * Register an init script that sets master localStorage BEFORE React mounts.
 * Call this once per page instance (e.g. in beforeEach), then navigate.
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, string>} state
 */
async function injectMasterAuth(page, state) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, {
    token: state.masterToken,
    user:  { email: state.masterEmail, role: 'master' },
  });
}

/**
 * Log in via the master login form (real UI flow).
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
async function loginMasterUI(page, email, password) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
}

/**
 * Log in via the admin login form (real UI flow).
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
async function loginAdminUI(page, email, password) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin/dashboard', { timeout: 10_000 });
}

module.exports = { getState, injectAdminAuth, injectMasterAuth, loginMasterUI, loginAdminUI };
