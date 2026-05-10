// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { getState } = require('../helpers');

test.use({ baseURL: process.env.ADMIN_URL || 'http://localhost:3001' });
test.slow();

test.describe('Admin — Login', () => {
  test('login as organizer admin', async ({ page }) => {
    const state = getState();

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.fill('input[type="email"]', state.orgEmail);
    await page.waitForTimeout(1000);

    await page.fill('input[type="password"]', state.orgPassword);
    await page.waitForTimeout(1000);

    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });
    await page.waitForTimeout(1000);

    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.locator('h1, nav, .dashboard').first()).toBeVisible();
    await page.waitForTimeout(1000);
  });
});
