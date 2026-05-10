'use strict';
const mongoose = require('mongoose');

// Tracks every reminder that has been sent so we never double-send.
// eventDateKey (YYYY-MM-DD) lets logs expire naturally when the event date changes.
const reminderLogSchema = new mongoose.Schema({
  organizationId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  registrantId:    { type: mongoose.Schema.Types.ObjectId, required: true },
  isVip:           { type: Boolean, default: false },
  daysBeforeEvent: { type: Number, required: true },
  // ISO date (YYYY-MM-DD) of the event's startDate — used to detect date changes
  eventDateKey:    { type: String, required: true },
  sentAt:          { type: Date, default: Date.now },
}, { timestamps: false });

// Composite unique index — one send per registrant × interval × event-date
reminderLogSchema.index(
  { organizationId: 1, registrantId: 1, daysBeforeEvent: 1, eventDateKey: 1 },
  { unique: true }
);

module.exports = mongoose.model('ReminderLog', reminderLogSchema);
