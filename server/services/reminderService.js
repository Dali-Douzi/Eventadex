'use strict';

const { buildEmailHtml }                                    = require('../utils/buildEmailHtml');
const { isAbsoluteUrl, readUpload, createTransport, getFrom } = require('./emailService');

// ── Lazy model imports (avoids circular-require issues at startup) ────────────
function models() {
  return {
    ReminderConfig: require('../models/ReminderConfig'),
    ReminderLog:    require('../models/ReminderLog'),
    Registrant:     require('../models/Registrant'),
    VipRegistrant:  require('../models/VipRegistrant'),
    Event:          require('../models/Event'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Countdown helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable countdown string accurate to the minute.
 * e.g. "3 days, 14 hours, and 22 minutes"
 */
function formatCountdown(msUntilEvent) {
  if (msUntilEvent <= 0) return 'now';
  const totalMins = Math.floor(msUntilEvent / 60_000);
  const days    = Math.floor(totalMins / (60 * 24));
  const hours   = Math.floor((totalMins % (60 * 24)) / 60);
  const minutes = totalMins % 60;

  const parts = [];
  if (days    > 0) parts.push(`${days} day${days       !== 1 ? 's' : ''}`);
  if (hours   > 0) parts.push(`${hours} hour${hours     !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);

  if (parts.length === 0) return 'moments';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts[0]}, ${parts[1]}, and ${parts[2]}`;
}

/**
 * Local subject-line substitution (mirrors buildEmailHtml's sub()).
 * Used only on the subject string (which isn't passed through buildEmailHtml).
 */
function subjectSub(str, vars) {
  if (!str) return '';
  return str
    .replace(/\{\{firstName\}\}/g,   vars.firstName   || '')
    .replace(/\{\{lastName\}\}/g,    vars.lastName    || '')
    .replace(/\{\{eventName\}\}/g,   vars.eventName   || '')
    .replace(/\{\{sessionName\}\}/g, vars.sessionName || '')
    .replace(/\{\{sessionDate\}\}/g, vars.sessionDate || '')
    .replace(/\{\{countdown\}\}/g,   vars.countdown   || '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Send one reminder to one registrant
// ─────────────────────────────────────────────────────────────────────────────
async function sendReminderEmail(registrant, config, event, countdown, countdownImageHtml) {
  const vars = {
    firstName:      registrant.firstName  || '',
    lastName:       registrant.lastName   || '',
    eventName:      event.name            || '',
    sessionName:    '',
    sessionDate:    '',
    countdown,
    countdownImage: countdownImageHtml,
  };

  // Resolve images (Cloudinary absolute URLs pass through; local paths read from disk)
  const tmpl          = config.toObject ? config.toObject() : { ...config };
  const logoBuffer    = readUpload(tmpl.logoUrl);
  const hdrBuffer     = readUpload(tmpl.headerImageUrl);
  const ftrBuffer     = readUpload(tmpl.footerImageUrl);

  const templateForHtml = {
    ...tmpl,
    logoUrl:        logoBuffer ? 'cid:logo'        : (isAbsoluteUrl(tmpl.logoUrl)        ? tmpl.logoUrl        : null),
    headerImageUrl: hdrBuffer  ? 'cid:headerImage' : (isAbsoluteUrl(tmpl.headerImageUrl) ? tmpl.headerImageUrl : null),
    footerImageUrl: ftrBuffer  ? 'cid:footerImage' : (isAbsoluteUrl(tmpl.footerImageUrl) ? tmpl.footerImageUrl : null),
  };

  const html    = buildEmailHtml(templateForHtml, vars);
  const subject = subjectSub(config.subject, vars);

  const attachments = [];
  if (logoBuffer) attachments.push({ filename: 'logo.png',        content: logoBuffer, contentType: 'image/png', cid: 'logo' });
  if (hdrBuffer)  attachments.push({ filename: 'headerImage.png', content: hdrBuffer,  contentType: 'image/png', cid: 'headerImage' });
  if (ftrBuffer)  attachments.push({ filename: 'footerImage.png', content: ftrBuffer,  contentType: 'image/png', cid: 'footerImage' });
  // Note: no QR code for reminders (registrant already has it from confirmation)

  const transporter = createTransport();
  await transporter.sendMail({ from: getFrom(), to: registrant.email, subject, html, attachments });
}

// ─────────────────────────────────────────────────────────────────────────────
// Core scheduler logic — called every 30 minutes
// ─────────────────────────────────────────────────────────────────────────────
async function runReminderCheck() {
  const { ReminderConfig, ReminderLog, Registrant, VipRegistrant, Event } = models();

  const now         = new Date();
  const currentHour = now.getUTCHours();
  const todayKey    = now.toISOString().slice(0, 10); // YYYY-MM-DD

  // Load all enabled reminder configs (one per org)
  const configs = await ReminderConfig.find({ enabled: true });
  if (configs.length === 0) return;

  console.log(`[Reminders] ${new Date().toISOString()} — checking ${configs.length} org(s)`);

  for (const config of configs) {
    // Only fire during the configured send-hour (UTC)
    if (currentHour !== config.sendHour) continue;

    const event = await Event.findOne({ organizationId: config.organizationId });
    if (!event?.startDate) continue;

    const eventDate    = new Date(event.startDate);
    const eventDateKey = eventDate.toISOString().slice(0, 10);

    // Skip if the event is in the past
    if (eventDate <= now) continue;

    const msUntilEvent     = eventDate - now;
    const countdown        = formatCountdown(msUntilEvent);

    // Build countdown image HTML for {{countdownImage}} token
    const siteUrl          = (process.env.SITE_URL || '').replace(/\/$/, '');
    const countdownImageHtml = siteUrl
      ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
           <tr><td align="center">
             <img src="${siteUrl}/api/countdown-image" alt="${countdown}" width="480"
                  style="display:block;max-width:480px;border-radius:8px;" />
           </td></tr>
         </table>`
      : '';

    for (const { daysBeforeEvent } of config.schedule) {
      // Compute the calendar date on which this interval fires
      const targetDate = new Date(eventDate.getTime() - daysBeforeEvent * 86_400_000);
      const targetKey  = targetDate.toISOString().slice(0, 10);

      if (targetKey !== todayKey) continue; // Not today for this interval

      console.log(`[Reminders] Org ${config.organizationId}: firing ${daysBeforeEvent}-day reminder`);

      // Fetch all registrants (regular + VIP) for this org
      const [regulars, vips] = await Promise.all([
        Registrant.find({ organizationId: config.organizationId }).lean(),
        VipRegistrant.find({ organizationId: config.organizationId }).lean(),
      ]);

      // Who already received this interval for this event date?
      const logs = await ReminderLog.find({
        organizationId:  config.organizationId,
        daysBeforeEvent,
        eventDateKey,
      }).lean();
      const alreadySent = new Set(logs.map(l => l.registrantId.toString()));

      let sent = 0, failed = 0;

      const sendBatch = async (list, isVip) => {
        for (const registrant of list) {
          const id = registrant._id.toString();
          if (alreadySent.has(id)) continue;

          try {
            await sendReminderEmail(registrant, config, event, countdown, countdownImageHtml);
            await ReminderLog.create({
              organizationId:  config.organizationId,
              registrantId:    registrant._id,
              isVip,
              daysBeforeEvent,
              eventDateKey,
            });
            alreadySent.add(id);
            sent++;
          } catch (err) {
            failed++;
            console.error(`[Reminders] Failed → ${registrant.email}:`, err.message);
          }
        }
      };

      await sendBatch(regulars, false);
      await sendBatch(vips,     true);

      console.log(`[Reminders] ${daysBeforeEvent}-day reminder: ${sent} sent, ${failed} failed`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler — runs every 30 minutes aligned to the clock
// ─────────────────────────────────────────────────────────────────────────────
let _schedulerInterval = null;

function startReminderScheduler() {
  if (_schedulerInterval) return; // already running

  // Align the first tick to the next :00 or :30 mark
  const now         = new Date();
  const nextHalfHour = new Date(now);
  const mins        = now.getMinutes();
  const minsToNext  = mins < 30 ? 30 - mins : 60 - mins;
  nextHalfHour.setMinutes(now.getMinutes() + minsToNext, 0, 0);
  const msToFirst   = nextHalfHour - now;

  console.log(`[Reminders] Scheduler armed — first check in ${Math.round(msToFirst / 60_000)} min`);

  setTimeout(() => {
    runReminderCheck().catch(err => console.error('[Reminders] Check error:', err));
    _schedulerInterval = setInterval(
      () => runReminderCheck().catch(err => console.error('[Reminders] Check error:', err)),
      30 * 60_000
    );
  }, msToFirst);
}

module.exports = { startReminderScheduler, runReminderCheck, formatCountdown, sendReminderEmail };
