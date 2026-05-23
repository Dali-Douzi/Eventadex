'use strict';

const { Schema, model } = require('mongoose');

const waitlistRegistrantSchema = new Schema(
  {
    organizationId:   { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    eventId:          { type: Schema.Types.ObjectId, ref: 'Event',        required: true },
    sessionId:        { type: Schema.Types.ObjectId },
    firstName:        { type: String, required: true, trim: true },
    lastName:         { type: String, required: true, trim: true },
    email:            { type: String, required: true, lowercase: true, trim: true },
    phone:            { type: String, trim: true },
    landline:         { type: String, trim: true },
    mobile:           { type: String, trim: true },
    gender:           { type: String, trim: true },
    country:          { type: String, trim: true },
    title:            { type: String, trim: true },
    hearAbout:        { type: String, trim: true },
    customFields:     { type: Map, of: String, default: {} },
    waitlistPosition: { type: Number, required: true },
    // 'waiting'  — in queue, not yet confirmed
    // 'promoted' — admin moved them to confirmed registration
    // 'cancelled' — removed from waitlist
    status:           { type: String, enum: ['waiting', 'promoted', 'cancelled'], default: 'waiting' },
    // Stored in case they paid before being race-conditioned into the waitlist
    paymentIntentId:  { type: String, trim: true },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    collection:  'waitlistregistrants',
  }
);

// One entry per email per org + event
waitlistRegistrantSchema.index({ organizationId: 1, eventId: 1, email: 1 }, { unique: true });
waitlistRegistrantSchema.index({ organizationId: 1, eventId: 1, sessionId: 1 });

module.exports = model('WaitlistRegistrant', waitlistRegistrantSchema);
