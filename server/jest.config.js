/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000,
  // Run tests sequentially within a file; workers can run in parallel across files
  maxWorkers: 1,        // serial across files too — avoids in-memory DB port conflicts
  forceExit: true,      // force exit after tests (mongoose keep-alive otherwise hangs)
  verbose: true,
};
