// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { getState } = require('../helpers');

test.use({ baseURL: process.env.MASTER_URL || 'http://localhost:3000' });
test.slow(); // generous timeouts for demo

test.describe('Master — Login', () => {
  test('login as master admin', async ({ page }) => {
    const state = getState();

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.fill('input[type="email"]', state.masterEmail);
    await page.waitForTimeout(1000);

    await page.fill('input[type="password"]', state.masterPassword);
    await page.waitForTimeout(1000);

    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    await page.waitForTimeout(1000);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1, h2, nav').first()).toBeVisible();
  });
});
