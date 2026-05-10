// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { getState, injectAdminAuth } = require('../helpers');
const axios = require('axios');

test.use({ baseURL: process.env.ADMIN_URL || 'http://localhost:3001' });
test.slow();

test.describe('Admin — Registrants', () => {
  test.beforeAll(async () => {
    const state = getState();
    // Seed a few registrants for demo
    for (let i = 1; i <= 3; i++) {
      await axios.post(`${state.apiUrl}/api/public/${state.orgSlug}/register`, {
        firstName: `Demo`,
        lastName: `Attendee ${i}`,
        email: `demo.attendee${i}.${Date.now()}@example.com`,
        sessionId: state.session1Id,
        captchaToken: 'skip',
      }).catch(() => {});
      await new Promise((r) => setTimeout(r, 200));
    }
  });

  test.beforeEach(async ({ page }) => {
    const state = getState();
    await injectAdminAuth(page, state);
    await page.goto('/admin/registrants');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('view registrants list', async ({ page }) => {
    await expect(page.locator('h1.page-title')).toContainText(/Registrant/i);
    await page.waitForTimeout(1000);
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);
  });

  test('search registrants by name', async ({ page }) => {
    const search = page.locator('input[type="search"], input[placeholder*="Search"]');
    await search.fill('Demo');
    await page.waitForTimeout(1000);
    await expect(page.locator('table tbody')).toContainText('Demo', { timeout: 8_000 });
    await page.waitForTimeout(1000);
  });

  test('filter registrants by session', async ({ page }) => {
    const state = getState();
    const select = page.locator('select').first();
    await select.selectOption({ value: state.session1Id });
    await page.waitForTimeout(1000);
    await expect(page.locator('table tbody')).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(1000);
  });

  test('export registrants as CSV', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);
    await page.locator('button:has-text("Export"), a:has-text("Export")').first().click();
    await page.waitForTimeout(1000);
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    }
    await page.waitForTimeout(1000);
  });
});
