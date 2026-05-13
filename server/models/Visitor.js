'use strict';

const { Schema, model } = require('mongoose');

const visitorSchema = new Schema(
  {
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    firstName:    { type: String, trim: true },
    lastName:     { type: String, trim: true },
    title:        { type: String, trim: true },
    organization: { type: String, trim: true },
    phone:        { type: String, trim: true },
    address:      { type: String, trim: true },
    locale:       { type: String, trim: true },
    klaviyoId:    { type: String, trim: true },
    year:         { type: Number, enum: [2024, 2025] },
  },
  { timestamps: true }
);

visitorSchema.index({ year: 1 });

module.exports = model('Visitor', visitorSchema);
