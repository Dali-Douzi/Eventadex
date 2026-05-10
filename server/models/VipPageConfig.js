const { Schema, model } = require('mongoose');

const footerLinkSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    url:   { type: String, required: true, trim: true },
  },
  { _id: false }
);

const formFieldSchema = new Schema(
  {
    fieldName: { type: String, required: true, trim: true },
    label:     { type: String, required: true, trim: true },
    type:      { type: String, enum: ['text', 'select', 'radio', 'checkbox', 'phone', 'email', 'landline', 'mobile'], required: true },
    required:  { type: Boolean, default: false },
    options:   { type: [String], default: [] },
    visible:   { type: Boolean, default: true },
  },
  { _id: false }
);

const vipPageConfigSchema = new Schema(
  {
    organizationId:  { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
    logoUrl:         { type: String, trim: true },
    primaryColor:    { type: String, trim: true, default: '#1a1a2e' },
    secondaryColor:  { type: String, trim: true, default: '#e2b96f' },
    textColor:       { type: String, trim: true },
    headerImageUrl:  { type: String, trim: true },
    footerImageUrl:  { type: String, trim: true },
    headerText:      { type: String, trim: true },
    subheaderText:   { type: String, trim: true },   // legacy — kept for backward compat
    durationStart:   { type: Date },
    durationEnd:     { type: Date },
    location:        { type: String, trim: true },
    footerText:      { type: String, trim: true },
    footerLinks:     { type: [footerLinkSchema], default: [] },
    formFields:      { type: [formFieldSchema], default: [] },
    logoWidth:           { type: Number },
    logoHeight:          { type: Number },
    logoFit:             { type: String, enum: ['fill', 'max', null], default: null },
    headerPadding:       { type: Number, default: 28 },
    headerImageHeight:   { type: Number, default: 180 },
    headerImageFit:      { type: String, enum: ['fill', 'max', null], default: null },
    footerImageHeight:   { type: Number, default: 80 },
    footerImageFit:      { type: String, enum: ['fill', 'max', null], default: null },
    footerImagePadding:  { type: Number, default: 0 },
    bodyBgType:          { type: String, default: '' },
    bodyBgColor:         { type: String, default: '' },
    bodyBgImageUrl:      { type: String, default: null },
    bodyBgImageSize:     { type: String, default: 'cover' },
    bodyBgGradient:      { type: String, default: '' },
    cardBgType:          { type: String, default: '' },
    cardBgColor:         { type: String, default: '' },
    cardBgGradient:      { type: String, default: '' },
  },
  { timestamps: true, collection: 'vippageconfigs' }
);

module.exports = model('VipPageConfig', vipPageConfigSchema);
