/**
 * PM2 ecosystem file — runs the full Eventadex stack WITHOUT Docker.
 *
 * Prerequisites (one-time):
 *   npm install -g pm2 serve
 *
 * Usage:
 *   npm run build:all          # build the three React apps first
 *   npm run start:prod         # launch everything via pm2
 *   npm run stop               # stop all pm2 processes
 *   npm run logs               # tail logs from all processes
 */
module.exports = {
  apps: [
    // ── Express API server ────────────────────────────────────────────────
    {
      name: 'api',
      script: 'index.js',
      cwd: './server',
      // reads server/.env automatically via dotenv inside index.js
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },

    // ── Platform Admin — client-master (port 3000) ────────────────────────
    {
      name: 'client-master',
      script: 'serve',
      args: '-s dist -p 3000 --no-clipboard',
      cwd: './client-master',
      interpreter: 'none',
      watch: false,
      autorestart: true,
    },

    // ── Event Admin — client-admin (port 3001) ────────────────────────────
    {
      name: 'client-admin',
      script: 'serve',
      args: '-s dist -p 3001 --no-clipboard',
      cwd: './client-admin',
      interpreter: 'none',
      watch: false,
      autorestart: true,
    },

    // ── Attendee Registration — client-user (port 3002) ───────────────────
    {
      name: 'client-user',
      script: 'serve',
      args: '-s dist -p 3002 --no-clipboard',
      cwd: './client-user',
      interpreter: 'none',
      watch: false,
      autorestart: true,
    },
  ],
};
