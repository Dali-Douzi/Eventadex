// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { getState, injectAdminAuth } = require('../helpers');

test.use({ baseURL: process.env.ADMIN_URL || 'http://localhost:3001' });
test.slow();

test.describe('Admin — Email Template', () => {
  test.beforeEach(async ({ page }) => {
    const state = getState();
    await injectAdminAuth(page, state);
    await page.goto('/admin/email-template');
    // Wait for the form fields — useEffect fetch completes after networkidle
    await page.waitForSelector('textarea', { timeout: 30_000 });
    await page.waitForTimeout(1000);
  });

  test('view email template page', async ({ page }) => {
    await expect(page.locator('input.input').first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);
    await expect(page.locator('textarea')).toBeVisible();
    await page.waitForTimeout(1000);
  });

  test('update subject and body then save', async ({ page }) => {
    const subject = page.locator('input.input').first();
    await subject.clear();
    await page.waitForTimeout(1000);
    await subject.fill('Welcome to the Demo Event — Registration Confirmed!');
    await page.waitForTimeout(1000);

    const body = page.locator('textarea').first();
    await body.clear();
    await page.waitForTimeout(1000);
    await body.fill(
      'Hi {{firstName}},\n\nYou are registered for {{eventName}}!\n\nSee you there.'
    );
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Save"), button:has-text("Update")').first().click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=/saved|Saved|Updated|success/i')).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(1000);
  });
});
