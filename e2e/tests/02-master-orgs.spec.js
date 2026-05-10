// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { getState, injectMasterAuth } = require('../helpers');

test.use({ baseURL: process.env.MASTER_URL || 'http://localhost:3000' });
test.slow();

test.describe('Master — Organizations', () => {
  test.beforeEach(async ({ page }) => {
    await injectMasterAuth(page, getState());
    await page.goto('/organizations');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('view organizations list', async ({ page }) => {
    await expect(page.locator('h1.page-title')).toContainText(/Organization/i);
    await page.waitForTimeout(1000);
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);
  });

  test('search for the E2E org', async ({ page }) => {
    const state = getState();
    const search = page.locator('input[type="search"], input[placeholder*="Search"]');
    await search.fill(state.orgName);
    await page.waitForTimeout(1000);
    await expect(page.locator('table tbody')).toContainText(state.orgName, { timeout: 8_000 });
    await page.waitForTimeout(1000);
  });

  test('create a new organization', async ({ page }) => {
    await page.locator('button:has-text("+ Add Organization")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('.modal, [role="dialog"]')).toBeVisible();

    const ts = Date.now();
    await page.fill('input[placeholder*="Acme"]', `Demo Org ${ts}`);
    await page.waitForTimeout(1000);

    await page.fill('input[type="email"]', `demo${ts}@example.com`);
    await page.waitForTimeout(1000);

    await page.locator('.modal input[type="password"]').fill('DemoPass123!');
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Create")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('.modal')).not.toBeVisible({ timeout: 8_000 });
    await expect(page.locator('table tbody')).toContainText(`Demo Org ${ts}`, { timeout: 8_000 });
    await page.waitForTimeout(1000);
  });

  test('edit the E2E org name', async ({ page }) => {
    const state = getState();
    const search = page.locator('input[type="search"], input[placeholder*="Search"]');
    await search.fill(state.orgName);
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Actions")').first().click();
    await page.waitForTimeout(1000);

    await page.locator('.dropdown-menu .dropdown-item:has-text("Edit")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('.modal')).toBeVisible();

    const nameInput = page.locator('#edit-org-form input').first();
    await nameInput.fill('E2E Playwright Org — Demo');
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Save Changes")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('.modal')).not.toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(1000);

    // Restore original name
    await search.fill(state.orgEmail);
    await page.waitForTimeout(800);
    await page.locator('button:has-text("Actions")').first().click();
    await page.waitForTimeout(500);
    await page.locator('.dropdown-menu .dropdown-item:has-text("Edit")').click();
    await page.waitForTimeout(500);
    await nameInput.fill('E2E Playwright Org');
    await page.locator('button:has-text("Save Changes")').click();
    await page.waitForTimeout(500);
  });

  test('manage org permissions', async ({ page }) => {
    const state = getState();
    const search = page.locator('input[type="search"], input[placeholder*="Search"]');
    await search.fill(state.orgName);
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Actions")').first().click();
    await page.waitForTimeout(1000);

    await page.locator('.dropdown-menu .dropdown-item:has-text("Permissions")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Admin Permissions')).toBeVisible();
    await page.waitForTimeout(1000);

    // All permissions visible
    await expect(page.locator('text=Export registrant data')).toBeVisible();
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Save Permissions")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('.modal')).not.toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(1000);
  });
});
