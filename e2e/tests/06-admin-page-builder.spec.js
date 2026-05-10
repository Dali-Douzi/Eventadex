// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { getState, injectAdminAuth } = require('../helpers');

test.use({ baseURL: process.env.ADMIN_URL || 'http://localhost:3001' });
test.slow();

test.describe('Admin — Page Builder', () => {
  test.beforeEach(async ({ page }) => {
    const state = getState();
    await injectAdminAuth(page, state);
    await page.goto('/admin/page-builder');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('view page builder', async ({ page }) => {
    await expect(page.locator('input[type="color"]').first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);
  });

  test('update primary color and save', async ({ page }) => {
    const primaryColor = page.locator('input[type="color"]').first();
    await primaryColor.fill('#1d4ed8');
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Save"), button:has-text("Update")').first().click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=/saved|Saved|Updated|success/i')).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(1000);
  });

  test('form fields list is visible', async ({ page }) => {
    await expect(page.locator('text=/Field|field|Form/i').first()).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(1000);
  });
});
