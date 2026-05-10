require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// ── Crash handlers — catch anything that escapes try/catch ────────────────────
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection:', reason);
  process.exit(1);
});

// ── Required env-var validation — fail fast at startup ───────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'MONGO_URI', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[fatal] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// Force public DNS — router DNS doesn't support SRV record lookups required by mongodb+srv://
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const app      = require('./app');
const { startReminderScheduler } = require('./services/reminderService');

const PORT = process.env.PORT || 5000;

// ── MongoDB + server start ────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => {
    console.log('MongoDB connected');
    startReminderScheduler();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
