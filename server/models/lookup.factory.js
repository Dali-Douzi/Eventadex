const { Schema, model } = require('mongoose');

/**
 * Factory that produces lookup models sharing the same shape.
 * organizationId: null  → global value seeded by master
 * organizationId: ObjectId → org-specific value created by admin
 */
function createLookupModel(modelName) {
  const schema = new Schema(
    {
      organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
      name:           { type: String, required: true, trim: true },
      status:         { type: String, enum: ['available', 'deleted'], default: 'available' },
    },
    { timestamps: true }
  );

  // Unique name per org (null counts as global scope)
  schema.index({ organizationId: 1, name: 1 }, { unique: true });

  return model(modelName, schema);
}

module.exports = createLookupModel;
