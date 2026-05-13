'use strict';

const mongoose = require('mongoose');

// ─── Per-field typography / visibility config ─────────────────────────────────
const fieldSchema = new mongoose.Schema({
  fieldName:  { type: String, required: true },
  label:      { type: String, default: '' },
  visible:    { type: Boolean, default: true },
  fontSize:   { type: Number, default: 10, min: 4, max: 72 },
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

  // ── Canvas ────────────────────────────────────────────────
  width:              { type: Number, default: 85,  min: 30,  max: 300 },
  height:             { type: Number, default: 54,  min: 20,  max: 300 },
  padding:            { type: Number, default: 3,   min: 0,   max: 20  },
  backgroundColor:    { type: String, default: '#ffffff' },
  backgroundImageUrl: { type: String, default: '' },

  // ── Header ────────────────────────────────────────────────
  headerHeight:       { type: Number,  default: 12,      min: 0,  max: 60  },
  showHeaderDivider:  { type: Boolean, default: true },
  headerDividerColor: { type: String,  default: '#e2e8f0' },

  // ── Logo ──────────────────────────────────────────────────
  showLogo:     { type: Boolean, default: true },
  logoPosition: { type: String,  default: 'top-left', enum: ['top-left', 'top-center', 'top-right'] },
  logoMaxWidth:  { type: Number, default: 28,  min: 5,  max: 100 },
  logoMaxHeight: { type: Number, default: 9,   min: 3,  max: 50  },

  // ── Event name ────────────────────────────────────────────
  showEventName:   { type: Boolean, default: true },
  eventNameSize:   { type: Number,  default: 7.5, min: 4, max: 36  },
  eventNameWeight: { type: Number,  default: 600, min: 100, max: 900 },
  eventNameColor:  { type: String,  default: '#1e293b' },

  // ── Fields (middle) ───────────────────────────────────────
  fieldGap:       { type: Number, default: 0.8, min: 0, max: 15 },
  middlePaddingY: { type: Number, default: 1.5, min: 0, max: 15 },

  // ── Footer / QR ───────────────────────────────────────────
  footerHeight:       { type: Number,  default: 18,      min: 0,  max: 60  },
  showFooterDivider:  { type: Boolean, default: true },
  footerDividerColor: { type: String,  default: '#e2e8f0' },
  showQrCode:         { type: Boolean, default: true },
  qrPosition:         { type: String,  default: 'bottom-right', enum: ['bottom-left', 'center', 'bottom-right'] },
  qrSize:             { type: Number,  default: 17, min: 8, max: 50 },

  fields: [fieldSchema],

}, { timestamps: true });

module.exports = mongoose.model('BadgeConfig', badgeConfigSchema);
