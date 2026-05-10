'use strict';
const mongoose = require('mongoose');

// One document per organization — upserted on first GET
const reminderConfigSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true,
  },

  // ── Schedule ─────────────────────────────────────────────────────────────────
  enabled:  { type: Boolean, default: false },
  // Array of { daysBeforeEvent: 7 } entries — each triggers one reminder send
  schedule: {
    type: [{
      daysBeforeEvent: { type: Number, required: true },
    }],
    default: [],
    _id: false,
  },
  // UTC hour (0-23) to send reminders on matching days
  sendHour: { type: Number, default: 9, min: 0, max: 23 },

  // ── Email template (mirrors EmailTemplate schema) ─────────────────────────
  subject:            { type: String, default: "Reminder: {{eventName}} is coming up!" },
  headerText:         { type: String, default: '' },
  bodyText: {
    type: String,
    default: "Hi {{firstName}},\n\nThis is a friendly reminder that {{eventName}} starts in {{countdown}}.\n\nWe look forward to seeing you!",
  },
  customHtml:         { type: String, default: '' },
  footerText:         { type: String, default: '' },
  buttonLabel:        { type: String, default: 'View Event Details' },
  buttonColor:        { type: String, default: '#2563eb' },
  buttonTextColor:    { type: String, default: '#ffffff' },

  // Image URLs
  logoUrl:            { type: String, default: null },
  headerImageUrl:     { type: String, default: null },
  footerImageUrl:     { type: String, default: null },

  // Image display options (mirrors EmailTemplate)
  logoWidth:          { type: Number, default: null },
  logoHeight:         { type: Number, default: null },
  logoFit:            { type: String, default: null },
  logoPlacement:      { type: String, default: 'left' },
  headerPadding:      { type: Number, default: 28 },
  headerImageHeight:  { type: Number, default: 200 },
  headerImageFit:     { type: String, default: null },
  footerImageHeight:  { type: Number, default: 120 },
  footerImageFit:     { type: String, default: null },
  footerImagePadding: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('ReminderConfig', reminderConfigSchema);
