'use strict';

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const compression  = require('compression');
const path         = require('path');
const mongoose     = require('mongoose');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── Security headers ──────────────────────────────────────────────────────────
// crossOriginResourcePolicy: false so Cloudinary images embedded in emails/pages
// aren't blocked when loaded cross-origin.
app.use(helmet({ crossOriginResourcePolicy: false }));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_MASTER_URL || 'http://localhost:3000',
  process.env.CLIENT_ADMIN_URL  || 'http://localhost:3001',
  process.env.CLIENT_USER_URL   || 'http://localhost:3002',
].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Static uploads (dev fallback — images are served from Cloudinary in prod) ─
// Kept so legacy `/uploads/…` paths in local dev still resolve.
// In production all new images are Cloudinary URLs and this directory is empty.
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// ── Countdown image (public — no auth, embedded in reminder emails) ──────────
// Returns a live-updating SVG so each email open shows the current countdown.
app.get('/api/countdown-image', async (req, res) => {
  try {
    const Event = require('./models/Event');
    // Use orgId query param when available, otherwise first org with a future event
    const filter = req.query.org
      ? { organizationId: req.query.org }
      : {};
    const events = await Event.find(filter).lean();
    const event  = events.find(e => e.startDate && new Date(e.startDate) > new Date())
                || events[0];

    const msLeft    = event?.startDate ? Math.max(0, new Date(event.startDate) - Date.now()) : 0;
    const totalMins = Math.floor(msLeft / 60_000);
    const days      = Math.floor(totalMins / (60 * 24));
    const hours     = Math.floor((totalMins % (60 * 24)) / 60);
    const mins      = totalMins % 60;

    const label = msLeft <= 0
      ? 'Event is live!'
      : [
          days  > 0 ? `${days}d`  : '',
          hours > 0 ? `${hours}h` : '',
          mins  > 0 ? `${mins}m`  : '',
        ].filter(Boolean).join('  ') || 'Starting soon';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="80" viewBox="0 0 480 80">
  <rect width="480" height="80" rx="10" fill="#1e293b"/>
  <text x="240" y="22" font-family="Arial,sans-serif" font-size="12" font-weight="600"
        fill="#94a3b8" text-anchor="middle" letter-spacing="2">COUNTDOWN</text>
  <text x="240" y="60" font-family="Arial,sans-serif" font-size="36" font-weight="700"
        fill="#ffffff" text-anchor="middle">${label}</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.send(svg);
  } catch (err) {
    console.error('[countdown-image]', err.message);
    res.status(500).send('');
  }
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',   require('./routes/authRoutes'));
app.use('/api/master', require('./routes/masterRoutes'));
app.use('/api/admin',  require('./routes/adminRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    db:        mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// ── 404 catch-all for unknown API routes ──────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
