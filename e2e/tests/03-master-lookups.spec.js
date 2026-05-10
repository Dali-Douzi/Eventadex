// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { getState, injectMasterAuth } = require('../helpers');

test.use({ baseURL: process.env.MASTER_URL || 'http://localhost:3000' });
test.slow();

test.describe('Master — Lookups', () => {
  test.beforeEach(async ({ page }) => {
    await injectMasterAuth(page, getState());
    await page.goto('/lookups/countries');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('view countries lookup page', async ({ page }) => {
    await expect(page.locator('h1.page-title')).toContainText('Countries');
    await page.waitForTimeout(1000);
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);
  });

  test('add a new country', async ({ page }) => {
    await page.locator('button:has-text("+ Add Country")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('.modal')).toBeVisible();

    const uniqueName = `Demo Country ${Date.now()}`;
    await page.locator('#lookup-add-form input.input').fill(uniqueName);
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Add"):not([disabled])').last().click();
    await page.waitForTimeout(1000);

    await expect(page.locator('table tbody')).toContainText(uniqueName, { timeout: 8_000 });
    await page.waitForTimeout(1000);
  });
});
