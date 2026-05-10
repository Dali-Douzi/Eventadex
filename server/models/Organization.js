const { Schema, model } = require('mongoose');

const organizationSchema = new Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role:     { type: String, default: 'admin', immutable: true },
    status:   { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
    eventId:  { type: Schema.Types.ObjectId, ref: 'Event', unique: true, sparse: true },
    slug:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    permissions: {
      canExportData:      { type: Boolean, default: true },
      canCheckIn:         { type: Boolean, default: true },
      canViewVip:         { type: Boolean, default: true },
      canEditPageBuilder: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = model('Organization', organizationSchema);
