// @ts-check
'use strict';

require('dotenv').config({ path: __dirname + '/.env' });

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,        // keep sequential — tests share one live DB
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,                  // one worker to avoid race conditions on shared data
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    // each spec overrides baseURL via test.use()
    baseURL: 'http://localhost:3000',
    headless: false,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  globalSetup:    require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),

  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
