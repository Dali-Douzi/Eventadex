'use strict';

const mongoose = require('mongoose');

// ─── Per-field typography / visibility config ─────────────────────────────────
const fieldSchema = new mongoose.Schema({
  fieldName:  { type: String, required: true },
  label:      { type: String, default: '' },
  visible:    { type: Boolean, default: true },
  fontSize:   { type: Number, default: 10, min: 4, max: 36 },
  fontWeight: { type: String, enum: ['normal', 'bold'], default: 'normal' },
  textColor:  { type: String, default: '#000000' },
  align:      { type: String, enum: ['left', 'center', 'right'], default: 'center' },
  order:      { type: Number, default: 0 },
}, { _id: false });

// ─── Badge layout config ──────────────────────────────────────────────────────
const badgeConfigSchema = new mongoose.Schema({
  organizationId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Organization',
    required: true,
    unique:   true,
  },

  // Physical dimensions (mm)
  width:  { type: Number, default: 85, min: 30, max: 300 },
  height: { type: Number, default: 54, min: 20, max: 300 },

  // Background
  backgroundColor:    { type: String, default: '#ffffff' },
  backgroundImageUrl: { type: String, default: '' },

  // Logo
  showLogo:    { type: Boolean, default: true },
  logoPosition: {
    type:    String,
    enum:    ['top-left', 'top-center', 'top-right'],
    default: 'top-left',
  },

  // Event name
  showEventName: { type: Boolean, default: true },

  // QR code
  showQrCode:  { type: Boolean, default: true },
  qrPosition:  {
    type:    String,
    enum:    ['bottom-left', 'bottom-right', 'center'],
    default: 'bottom-right',
  },

  fields: [fieldSchema],

}, { timestamps: true });

module.exports = mongoose.model('BadgeConfig', badgeConfigSchema);
