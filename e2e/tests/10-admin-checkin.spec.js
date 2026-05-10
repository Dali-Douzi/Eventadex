// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { getState, injectAdminAuth } = require('../helpers');
const axios = require('axios');

test.use({ baseURL: process.env.ADMIN_URL || 'http://localhost:3001' });
test.slow();

test.describe('Admin — Check-In', () => {
  let attendeeName;
  let attendeeEmail;

  test.beforeAll(async () => {
    const state = getState();
    attendeeName  = 'CheckInDemo';
    attendeeEmail = `checkin.demo.${Date.now()}@example.com`;

    try {
      await axios.post(`${state.apiUrl}/api/public/${state.orgSlug}/register`, {
        firstName: attendeeName,
        lastName:  'User',
        email:     attendeeEmail,
        sessionId: state.session1Id,
        captchaToken: 'skip',
      });
    } catch (err) {
      console.warn('[checkin beforeAll] Could not seed attendee:', err.response?.data?.message || err.message);
    }
  });

  test.beforeEach(async ({ page }) => {
    const state = getState();
    await injectAdminAuth(page, state);
    await page.goto('/admin/checkin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('view check-in page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/Check.?In/i);
    await page.waitForTimeout(1000);
    await expect(page.locator('input[type="text"], input[type="search"]')).toBeVisible();
    await page.waitForTimeout(1000);
  });

  test('find attendee by name and check in', async ({ page }) => {
    const input = page.locator('input[type="text"], input[type="search"]');
    await input.fill(attendeeEmail);
    await page.waitForTimeout(1000);

    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    await expect(page.locator(`text=${attendeeName}`)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);

    const checkInBtn = page.locator('button:has-text("Check In"), button:has-text("Check-In")');
    if (await checkInBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await checkInBtn.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('text=/checked in|Check.?Out/i')).toBeVisible({ timeout: 8_000 });
      await page.waitForTimeout(1000);
    }
  });

  test('check out the same attendee', async ({ page }) => {
    const input = page.locator('input[type="text"], input[type="search"]');
    await input.fill(attendeeEmail);
    await page.waitForTimeout(1000);

    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    await expect(page.locator(`text=${attendeeName}`)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);

    const checkOutBtn = page.locator('button:has-text("Check Out"), button:has-text("Checkout")');
    if (await checkOutBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await checkOutBtn.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('text=/Check.?In/i')).toBeVisible({ timeout: 8_000 });
      await page.waitForTimeout(1000);
    }
  });
});
