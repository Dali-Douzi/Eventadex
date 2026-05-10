const { Schema, model } = require('mongoose');

const registrantSchema = new Schema(
  {
    organizationId:    { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    eventId:           { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    sessionId:         { type: Schema.Types.ObjectId },
    firstName:         { type: String, required: true, trim: true },
    lastName:          { type: String, required: true, trim: true },
    email:             { type: String, required: true, lowercase: true, trim: true },
    phone:             { type: String, trim: true },
    landline:          { type: String, trim: true },
    mobile:            { type: String, trim: true },
    gender:            { type: String, trim: true },
    country:           { type: String, trim: true },
    title:             { type: String, trim: true },
    hearAbout:         { type: String, trim: true },
    registerInterest:  { type: String, trim: true },
    sponsorType:       { type: String, trim: true },
    wingType:          { type: String, trim: true },
    customFields:      { type: Map, of: String, default: {} },
    qrCode:            { type: String, required: true, unique: true },
    checkedIn:         { type: Boolean, default: false },
    checkedInAt:       { type: Date },
    checkedOut:        { type: Boolean, default: false },
    checkedOutAt:      { type: Date },
    paymentStatus:     { type: String, enum: ['free', 'pending', 'paid'], default: 'free' },
    paymentIntentId:   { type: String, trim: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// Unique email per organization+event (one registration per attendee per event)
registrantSchema.index({ organizationId: 1, eventId: 1, email: 1 }, { unique: true });
// Fast lookups by org and event
registrantSchema.index({ organizationId: 1, eventId: 1 });
module.exports = model('Registrant', registrantSchema);
