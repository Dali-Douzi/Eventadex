// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { getState } = require('../helpers');

test.use({ baseURL: process.env.USER_URL || 'http://localhost:3002' });
test.slow();

test.describe('User — Registration Flow', () => {
  let state;

  test.beforeAll(() => {
    state = getState();
  });

  test('registration page loads', async ({ page }) => {
    await page.goto(`/${state.orgSlug}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page.locator('text=/Personal|First Name|Registration/i').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1000);
  });

  test('complete full registration — Step 1 to Confirmation', async ({ page }) => {
    const email = `playwright.demo.${Date.now()}@example.com`;

    // ── Step 1: Personal Info ──────────────────────────────────────────────
    await page.goto(`/${state.orgSlug}`);
    // Wait for the form fields to be visible (page finishes loading)
    await page.waitForSelector('.field-label, input[type="text"], input[type="email"]', { timeout: 20_000 });
    await page.waitForTimeout(1000);

    await page.locator('input[placeholder*="First"], input[name="firstName"]').first().fill('Playwright');
    await page.waitForTimeout(1000);

    await page.locator('input[placeholder*="Last"], input[name="lastName"]').first().fill('Demo');
    await page.waitForTimeout(1000);

    await page.locator('input[type="email"]').fill(email);
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Next"), button:has-text("Continue")').first().click();
    await page.waitForTimeout(1000);

    // ── Step 2: Session Selection ──────────────────────────────────────────
    // Sessions are div[role="radio"] cards, NOT input[type="radio"]
    await page.waitForSelector('.session-card', { timeout: 15_000 });
    await expect(page.locator('.session-card').first()).toBeVisible();
    await page.waitForTimeout(1000);

    // Click the first available (non-full) session card
    await page.locator('.session-card:not(.session-full)').first().click();
    await page.waitForTimeout(1000);

    // Verify it's selected
    await expect(page.locator('.session-selected')).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Next"), button:has-text("Continue")').first().click();
    await page.waitForTimeout(1000);

    // ── Step 3: Review ─────────────────────────────────────────────────────
    await page.waitForSelector('.review-section, h2', { timeout: 15_000 });
    await expect(page.locator('text=/Review|Confirm/i').first()).toBeVisible();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Playwright')).toBeVisible();
    await page.waitForTimeout(1000);

    // Complete reCAPTCHA (uses Google test key — checkbox auto-approves)
    const recaptchaFrame = page.frameLocator('iframe[src*="recaptcha"][src*="anchor"]');
    const checkbox = recaptchaFrame.locator('.recaptcha-checkbox-border');
    if (await checkbox.isVisible({ timeout: 6_000 }).catch(() => false)) {
      await checkbox.click();
      await page.waitForTimeout(2000);
    }

    // Wait for submit button to become enabled (captcha solved)
    const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Register"), button:has-text("Confirm Registration")').first();
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await page.waitForTimeout(500);

    await submitBtn.click();
    await page.waitForTimeout(1000);

    // ── Confirmation ───────────────────────────────────────────────────────
    await page.waitForURL(/\/confirmation|\/confirm/, { timeout: 30_000 });
    await page.waitForTimeout(1000);

    await expect(page.locator('text=/Playwright|Thank you|registered|confirmed/i').first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);
  });

  test('step indicator shows progress', async ({ page }) => {
    await page.goto(`/${state.orgSlug}`);
    await page.waitForSelector('.step-indicator, .steps, [class*="step"]', { timeout: 15_000 });
    await page.waitForTimeout(1000);

    await expect(page.locator('text=/Personal/i').first()).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/Session/i').first()).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/Review/i').first()).toBeVisible();
    await page.waitForTimeout(1000);
  });

  test('back button returns to previous step', async ({ page }) => {
    await page.goto(`/${state.orgSlug}`);
    await page.waitForSelector('.field-label, input[type="text"]', { timeout: 20_000 });
    await page.waitForTimeout(1000);

    // Fill Step 1
    await page.locator('input[placeholder*="First"], input[name="firstName"]').first().fill('Back');
    await page.waitForTimeout(1000);
    await page.locator('input[placeholder*="Last"], input[name="lastName"]').first().fill('ButtonTest');
    await page.waitForTimeout(1000);
    await page.locator('input[type="email"]').fill(`back.${Date.now()}@example.com`);
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Next"), button:has-text("Continue")').first().click();
    await page.waitForTimeout(1000);

    // Step 2 — select session card
    await page.waitForSelector('.session-card', { timeout: 15_000 });
    await page.locator('.session-card:not(.session-full)').first().click();
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("Next"), button:has-text("Continue")').first().click();
    await page.waitForTimeout(1000);

    // Review — click Back
    await page.waitForSelector('button:has-text("Back"), button:has-text("Previous")', { timeout: 10_000 });
    await page.locator('button:has-text("Back"), button:has-text("Previous")').click();
    await page.waitForTimeout(1000);

    // Should be back on session step
    await expect(page.locator('.session-card').first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);
  });
});
