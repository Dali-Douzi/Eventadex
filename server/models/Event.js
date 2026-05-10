const { Schema, model } = require('mongoose');

const sessionSchema = new Schema(
  {
    name:              { type: String, required: true, trim: true },
    date:              { type: Date, required: true },
    capacity:          { type: Number, required: true, min: 0 },
    waitlistCapacity:  { type: Number, default: 0, min: 0 },
    registered:        { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const EVENT_TYPES = [
  'Conference',
  'Workshop',
  'Seminar',
  'Networking Event',
  'Trade Show',
  'Exhibition',
  'Gala / Dinner',
  'Corporate Meeting',
  'Training',
  'Webinar',
  'Community Event',
  'Other',
];

const eventSchema = new Schema(
  {
    organizationId:       { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name:                 { type: String, required: true, trim: true },
    description:          { type: String, trim: true },
    eventType:            { type: String, enum: EVENT_TYPES, default: 'Conference' },
    startDate:            { type: Date, required: true },
    endDate:              { type: Date, required: true },
    registrationOpenDate: { type: Date },
    status:               { type: String, enum: ['draft', 'published', 'closed'], default: 'draft' },
    ticketPrice:          { type: Number, default: 0, min: 0 },
    currency:             { type: String, default: 'USD', uppercase: true, trim: true },
    paymentEnabled:       { type: Boolean, default: false },
    sessions:             { type: [sessionSchema], default: [] },
  },
  { timestamps: true }
);

const EventModel = model('Event', eventSchema);
EventModel.EVENT_TYPES = EVENT_TYPES;

module.exports = EventModel;
