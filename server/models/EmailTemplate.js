const { Schema, model } = require('mongoose');

const emailTemplateSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
    subject:         { type: String, required: true, trim: true },
    headerText:      { type: String, trim: true },
    bodyText:        { type: String, trim: true },
    footerText:      { type: String, trim: true },
    buttonLabel:     { type: String, trim: true },
    buttonColor:     { type: String, trim: true },
    buttonTextColor: { type: String, trim: true },
    logoUrl:          { type: String,  trim: true, default: null },
    logoWidth:        { type: Number,  default: null },
    logoHeight:       { type: Number,  default: null },
    logoFit:          { type: String,  trim: true, default: null },
    headerImageUrl:   { type: String,  trim: true, default: null },
    headerImageHeight:{ type: Number,  default: 200 },
    headerImageFit:   { type: String,  trim: true, default: null },
    footerImageUrl:     { type: String,  trim: true, default: null },
    footerImageHeight:  { type: Number,  default: 120 },
    footerImageFit:     { type: String,  trim: true, default: null },
    footerImagePadding: { type: Number,  default: 0 },
    logoPlacement:      { type: String,  trim: true, default: 'left' },
    headerPadding:      { type: Number,  default: 28 },
  },
  { timestamps: true }
);

module.exports = model('EmailTemplate', emailTemplateSchema);
