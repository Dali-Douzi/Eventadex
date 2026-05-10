// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { getState, injectAdminAuth } = require('../helpers');

test.use({ baseURL: process.env.ADMIN_URL || 'http://localhost:3001' });
test.slow();

test.describe('Admin — Event Setup', () => {
  test.beforeEach(async ({ page }) => {
    const state = getState();
    await injectAdminAuth(page, state);
    await page.goto('/admin/event');
    // Wait for the form card to appear — useEffect fetch completes after networkidle
    await page.waitForSelector('.event-form-card', { timeout: 30_000 });
    await page.waitForTimeout(1000);
  });

  test('view event setup page', async ({ page }) => {
    await expect(page.locator('h1.page-title')).toContainText(/Event Setup/i);
    await page.waitForTimeout(1000);
    await expect(page.locator('.event-form-card')).toBeVisible();
    await page.waitForTimeout(1000);
  });

  test('update event description and save', async ({ page }) => {
    const desc = page.locator('textarea.input');
    await desc.clear();
    await page.waitForTimeout(1000);
    await desc.fill('Live demo event powered by Playwright E2E tests.');
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Save Changes")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('button:has-text("✓ Saved"), button:has-text("Saved")')).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(1000);
  });

  test('view sessions and add a new one', async ({ page }) => {
    const state = getState();

    await expect(page.locator('.sessions-card')).toBeVisible();
    await page.waitForTimeout(1000);

    await expect(page.locator('.sessions-table')).toContainText(state.session1Name);
    await page.waitForTimeout(1000);

    await page.locator('.sessions-card-header button:has-text("Add Session")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('.modal-backdrop')).toBeVisible();

    await page.locator('input[placeholder*="Morning"]').fill('Evening Workshop');
    await page.waitForTimeout(1000);

    await page.locator('input[type="date"]').fill('2026-12-15');
    await page.waitForTimeout(1000);

    await page.locator('input[type="number"]').first().fill('60');
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Add Session")').last().click();
    await page.waitForTimeout(1000);

    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.sessions-table')).toContainText('Evening Workshop', { timeout: 8_000 });
    await page.waitForTimeout(1000);

    // Cleanup — delete the demo session
    const newRow = page.locator('tr:has-text("Evening Workshop")');
    page.on('dialog', (d) => d.accept());
    await newRow.locator('button[title="Delete session"]').click();
    await page.waitForTimeout(1000);
  });

  test('change event status to published', async ({ page }) => {
    const select = page.locator('select.input');
    await select.selectOption('published');
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Save Changes")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('button:has-text("✓ Saved"), button:has-text("Saved")')).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(1000);
  });
});
