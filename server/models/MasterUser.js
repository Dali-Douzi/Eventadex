const { Schema, model } = require('mongoose');

const masterUserSchema = new Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role:     { type: String, default: 'master', immutable: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

module.exports = model('MasterUser', masterUserSchema);
