const { Organization } = require('../models');

/**
 * Converts a string to a URL-friendly slug.
 * e.g. "Acme Corp!"  →  "acme-corp"
 */
function toSlug(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // strip non-word chars except spaces and hyphens
    .replace(/[\s_]+/g, '-')    // spaces / underscores → hyphen
    .replace(/-+/g, '-')        // collapse consecutive hyphens
    .replace(/^-|-$/g, '');     // strip leading/trailing hyphens
}

/**
 * Generates a slug from a base string and ensures uniqueness in the
 * organizations collection by appending a numeric suffix when needed.
 * Optionally pass excludeId to ignore the current org when updating.
 */
async function uniqueSlug(base, excludeId = null) {
  const baseSlug = toSlug(base);
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Organization.exists(query);
    if (!exists) return candidate;
    candidate = `${baseSlug}-${counter++}`;
  }
}

module.exports = { toSlug, uniqueSlug };
