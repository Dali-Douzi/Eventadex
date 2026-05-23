'use strict';

const { Schema, model } = require('mongoose');

const vipWaitlistRegistrantSchema = new Schema(
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
    status:           { type: String, enum: ['waiting', 'promoted', 'cancelled'], default: 'waiting' },
    paymentIntentId:  { type: String, trim: true },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    collection:  'vipwaitlistregistrants',
  }
);

vipWaitlistRegistrantSchema.index({ organizationId: 1, eventId: 1, email: 1 }, { unique: true });
vipWaitlistRegistrantSchema.index({ organizationId: 1, eventId: 1, sessionId: 1 });

module.exports = model('VipWaitlistRegistrant', vipWaitlistRegistrantSchema);
